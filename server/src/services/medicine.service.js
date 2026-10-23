import prisma from "../config/prisma.js";

import {
    getUserFarm,
    getUserTank,
    getUserSite
} from "../utils/farm.helpers.js";

import { MEDICINE_TYPES } from "../constants/medicineTypes.js";

/*
 * Get Medicine Stock availability for a Site and Medicine Type
 *
 * Total Medicine allocated to Site
 *              -
 * Medicine already used
 *              =
 * Remaining Medicine
 */
export const getSiteMedicineAvailability = async (
    farmId,
    siteId,
    medicineType = null,
    excludeMedicineId = null,
    client = prisma
) => {

    const directStockWhere = {
        siteId,
        farmId,
        category: "MEDICINE"
    };

    const resolvedTypes = (medicineType === "White Gut Supplement" || medicineType === "White Cul Supplement")
        ? ["White Gut Supplement", "White Cul Supplement"]
        : (medicineType ? [medicineType] : null);

    if (resolvedTypes) {
        directStockWhere.medicineType = { in: resolvedTypes };
    }

    /*
     * Get total MEDICINE added directly to this Site
     * plus legacy allocations.
     */
    const directStockResult =
        await client.stocking.aggregate({
            where: directStockWhere,
            _sum: {
                totalQuantity: true
            }
        });

    const allocationWhere = {
        siteId,
        stocking: {
            farmId,
            category: "MEDICINE",
            ...(resolvedTypes ? { medicineType: { in: resolvedTypes } } : {})
        }
    };

    const allocationResult =
        await client.siteStockAllocation.aggregate({
            where: allocationWhere,
            _sum: {
                allocatedQuantity: true
            }
        });

    const allocatedMedicine =
        (directStockResult._sum.totalQuantity ?? 0) +
        (allocationResult._sum.allocatedQuantity ?? 0);

    /*
     * Get total Medicine already used
     * at this Site for this medicine type.
     */
    const medicineUsageWhere = {
        tank: {
            site: {
                id: siteId,
                farmId
            }
        }
    };

    if (resolvedTypes) {
        medicineUsageWhere.OR = [
            { medicineType: { in: resolvedTypes } },
            { medicineName: { in: resolvedTypes } }
        ];
    }

    /*
     * When updating an existing Medicine entry,
     * exclude that entry from the usage calculation.
     */
    if (excludeMedicineId) {
        medicineUsageWhere.id = {
            not: excludeMedicineId
        };
    }

    const usageResult =
        await client.medicine.aggregate({
            where: medicineUsageWhere,
            _sum: {
                quantity: true
            }
        });

    const usedMedicine =
        usageResult._sum.quantity ?? 0;

    const remainingMedicine =
        Math.max(allocatedMedicine - usedMedicine, 0);

    // Fetch unit for this medicine type from stocking
    const stockRecord = await client.stocking.findFirst({
        where: directStockWhere,
        select: { unit: true },
        orderBy: { createdAt: "desc" }
    });
    const unit = stockRecord?.unit || "kg";

    return {
        allocatedMedicine,
        usedMedicine,
        remainingMedicine,
        unit
    };

};

/*
 * Get Medicine Stock Availability Service for API
 */
export const getMedicineStockAvailabilityService = async (
    userId,
    siteId,
    medicineType
) => {
    const farm = await getUserFarm(userId);
    const site = await getUserSite(farm.id, siteId);

    const resolvedType = medicineType === "White Cul Supplement" ? "White Gut Supplement" : medicineType;
    if (!resolvedType || !MEDICINE_TYPES.includes(resolvedType)) {
        throw new Error(
            `Invalid medicine type. Must be one of: ${MEDICINE_TYPES.join(", ")}`
        );
    }

    const stock = await getSiteMedicineAvailability(farm.id, site.id, resolvedType);

    return {
        siteId: site.id,
        siteName: site.siteName,
        medicineType: resolvedType,
        availableQuantity: stock.remainingMedicine,
        remainingMedicine: stock.remainingMedicine,
        allocatedMedicine: stock.allocatedMedicine,
        usedMedicine: stock.usedMedicine,
        unit: stock.unit
    };
};

/*
 * Create Medicine with Atomic Stock Deduction
 */
export const createMedicine = async (
    userId,
    medicineData
) => {

    const farm = await getUserFarm(userId);

    const tank = await getUserTank(
        farm.id,
        medicineData.tankId
    );

    let medicineType = medicineData.medicineType || medicineData.medicineName;
    if (medicineType === "White Cul Supplement") {
        medicineType = "White Gut Supplement";
    }
    if (!medicineType || !MEDICINE_TYPES.includes(medicineType)) {
        throw new Error(
            `Invalid medicine type. Must be one of: ${MEDICINE_TYPES.join(", ")}`
        );
    }

    const parsedQuantity = parseFloat(medicineData.quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        throw new Error("Quantity used must be greater than zero.");
    }

    return await prisma.$transaction(async (tx) => {
        /*
         * Check Medicine Stock available inside the transaction
         * to prevent concurrent requests from exceeding stock.
         */
        const stock =
            await getSiteMedicineAvailability(
                farm.id,
                tank.siteId,
                medicineType,
                null,
                tx
            );

        if (stock.allocatedMedicine <= 0) {
            throw new Error(
                `No stock available for ${medicineType} at this site.`
            );
        }

        if (parsedQuantity > stock.remainingMedicine) {
            throw new Error(
                `Insufficient ${medicineType} stock. Only ${stock.remainingMedicine} ${stock.unit} is available for this site.`
            );
        }

        const medicine =
            await tx.medicine.create({
                data: {
                    tankId: tank.id,
                    medicineName: medicineType,
                    medicineType: medicineType,
                    purpose: medicineData.purpose || "Water treatment",
                    dosage: medicineData.dosage || "As required",
                    quantity: parsedQuantity,
                    cost: parseFloat(medicineData.cost) || 0,
                    date: new Date(medicineData.date),
                    notes: medicineData.notes ? medicineData.notes.trim() : null
                },
                include: {
                    tank: {
                        include: {
                            site: true
                        }
                    }
                }
            });

        return medicine;
    });

};


/*
 * Get all Medicines
 */
export const getMedicines = async (
    userId
) => {

    const farm =
        await getUserFarm(userId);


    const medicines =
        await prisma.medicine.findMany({

            where: {

                tank: {

                    site: {

                        farmId:
                            farm.id

                    }

                }

            },

            include: {
                tank: {
                    include: {
                        site: true
                    }
                }
            },

            orderBy: {

                date: "desc"

            }

        });


    return medicines;

};


/*
 * Get Medicine by ID
 */
export const getMedicineById = async (
    userId,
    medicineId
) => {

    const farm =
        await getUserFarm(userId);


    const medicine =
        await prisma.medicine.findFirst({

            where: {

                id:
                    medicineId,

                tank: {

                    site: {

                        farmId:
                            farm.id

                    }

                }

            },

            include: {
                tank: {
                    include: {
                        site: true
                    }
                }
            }

        });


    if (!medicine) {

        throw new Error(
            "Medicine entry not found."
        );

    }


    return medicine;

};


/*
 * Update Medicine
 */
export const updateMedicine = async (
    userId,
    medicineId,
    medicineData
) => {

    const existingMedicine =
        await getMedicineById(
            userId,
            medicineId
        );

    const farm =
        await getUserFarm(userId);

    const tank =
        await getUserTank(
            farm.id,
            existingMedicine.tank.id
        );

    let medicineType =
        medicineData.medicineType ||
        medicineData.medicineName ||
        existingMedicine.medicineType ||
        existingMedicine.medicineName;
    if (medicineType === "White Cul Supplement") {
        medicineType = "White Gut Supplement";
    }

    const newQuantity =
        medicineData.quantity !== undefined
            ? parseFloat(medicineData.quantity)
            : existingMedicine.quantity;

    if (isNaN(newQuantity) || newQuantity <= 0) {
        throw new Error("Quantity used must be greater than zero.");
    }

    return await prisma.$transaction(async (tx) => {
        const stock =
            await getSiteMedicineAvailability(
                farm.id,
                tank.siteId,
                medicineType,
                medicineId,
                tx
            );

        if (stock.allocatedMedicine <= 0) {
            throw new Error(
                `No stock available for ${medicineType} at this site.`
            );
        }

        if (newQuantity > stock.remainingMedicine) {
            throw new Error(
                `Insufficient ${medicineType} stock. Only ${stock.remainingMedicine} ${stock.unit} is remaining for this site.`
            );
        }

        const updateData = {
            ...(medicineData.medicineName || medicineData.medicineType
                ? { medicineName: medicineType, medicineType }
                : {}),

            ...(medicineData.purpose !== undefined
                ? { purpose: medicineData.purpose }
                : {}),

            ...(medicineData.dosage !== undefined
                ? { dosage: medicineData.dosage }
                : {}),

            quantity: newQuantity,

            ...(medicineData.cost !== undefined
                ? { cost: parseFloat(medicineData.cost) }
                : {}),

            ...(medicineData.date
                ? { date: new Date(medicineData.date) }
                : {}),

            ...(medicineData.notes !== undefined
                ? { notes: medicineData.notes ? medicineData.notes.trim() : null }
                : {})
        };

        const medicine =
            await tx.medicine.update({
                where: {
                    id: medicineId
                },
                data: updateData,
                include: {
                    tank: {
                        include: {
                            site: true
                        }
                    }
                }
            });

        return medicine;
    });

};


/*
 * Delete Medicine
 */
export const deleteMedicine = async (
    userId,
    medicineId
) => {

    await getMedicineById(

        userId,

        medicineId

    );


    await prisma.medicine.delete({

        where: {

            id:
                medicineId

        }

    });


    return {

        message:
            "Medicine entry deleted successfully."

    };

};


/*
 * Get Medicine Summary
 */
export const getMedicineSummary = async (
    userId
) => {

    const farm =
        await getUserFarm(userId);


    const medicines =
        await prisma.medicine.findMany({

            where: {

                tank: {

                    site: {

                        farmId:
                            farm.id

                    }

                }

            }

        });


    const totalCost =
        medicines.reduce(

            (sum, item) =>
                sum + item.cost,

            0

        );


    return {

        totalEntries:
            medicines.length,

        totalCost

    };

};