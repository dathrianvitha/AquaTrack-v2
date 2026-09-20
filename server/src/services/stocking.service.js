import prisma from "../config/prisma.js";

import {
    getUserFarm,
    getUserSite
} from "../utils/farm.helpers.js";


/*
 * Calculate quantity already used
 * for a stocking category at a Site.
 */
const getSiteStockUsage = async (
    farmId,
    siteId,
    category
) => {

    if (category === "FEED") {

        const result =
            await prisma.feedEntry.aggregate({

                where: {

                    crop: {

                        tank: {

                            site: {

                                id: siteId,

                                farmId

                            }

                        }

                    }

                },

                _sum: {

                    quantity: true

                }

            });

        return result._sum.quantity ?? 0;

    }


    if (category === "MEDICINE") {

        const result =
            await prisma.medicine.aggregate({

                where: {

                    tank: {

                        site: {

                            id: siteId,

                            farmId

                        }

                    }

                },

                _sum: {

                    quantity: true

                }

            });

        return result._sum.quantity ?? 0;

    }


    return 0;

};


/*
 * Create Direct Site Stock
 */
export const createStocking = async (
    userId,
    stockingData
) => {

    const farm = await getUserFarm(userId);

    const site = await getUserSite(
        farm.id,
        stockingData.siteId
    );

    const stocking =
        await prisma.stocking.create({

            data: {

                category:
                    stockingData.category,

                totalQuantity:
                    stockingData.totalQuantity,

                unit:
                    stockingData.unit ?? (stockingData.category === "MEDICINE" ? "L" : "kg"),

                costPerKg:
                    stockingData.costPerKg ?? null,

                siteId:
                    site.id,

                farmId:
                    farm.id,

                ...(stockingData.stockingDate ? { createdAt: new Date(stockingData.stockingDate) } : {})

            },

            include: {

                site: true

            }

        });


    return stocking;

};


/*
 * Get all Stock & Site-Wise Inventory
 */
export const getStockings = async (
    userId
) => {

    const farm =
        await getUserFarm(userId);


    /*
     * Fetch user's Sites
     */
    const sites =
        await prisma.site.findMany({

            where: {

                farmId: farm.id

            },

            orderBy: {

                siteName: "asc"

            }

        });


    /*
     * Fetch all Stocking records for the Farm
     */
    const stockings =
        await prisma.stocking.findMany({

            where: {

                farmId: farm.id

            },

            include: {

                site: true,

                transfer: {

                    include: {

                        fromSite: true

                    }

                },

                allocations: {

                    include: {

                        site: true

                    }

                }

            },

            orderBy: {

                createdAt: "desc"

            }

        });


    const result = [];


    for (const stocking of stockings) {

        const targetSiteId = stocking.siteId || (stocking.allocations.length > 0 ? stocking.allocations[0].siteId : null);

        const totalUsed = targetSiteId
            ? await getSiteStockUsage(farm.id, targetSiteId, stocking.category)
            : 0;

        const totalAllocated = stocking.allocations.reduce(
            (sum, allocation) => sum + allocation.allocatedQuantity,
            0
        );

        const totalRemaining = Math.max(
            stocking.totalQuantity - totalUsed,
            0
        );

        const siteStock = [];

        if (stocking.site) {

            const usedQuantity = await getSiteStockUsage(farm.id, stocking.site.id, stocking.category);

            siteStock.push({

                allocationId: stocking.id,

                site: stocking.site,

                allocatedQuantity: stocking.totalQuantity,

                usedQuantity,

                remainingQuantity: Math.max(stocking.totalQuantity - usedQuantity, 0),

                unit: stocking.unit,

                transfer: stocking.transfer ? {
                    id: stocking.transfer.id,
                    fromSiteId: stocking.transfer.fromSiteId,
                    fromSiteName: stocking.transfer.fromSite?.siteName
                } : null

            });

        } else if (stocking.allocations.length > 0) {

            for (const allocation of stocking.allocations) {

                const usedQuantity = await getSiteStockUsage(farm.id, allocation.siteId, stocking.category);

                siteStock.push({

                    allocationId: allocation.id,

                    site: allocation.site,

                    allocatedQuantity: allocation.allocatedQuantity,

                    usedQuantity,

                    remainingQuantity: Math.max(allocation.allocatedQuantity - usedQuantity, 0),

                    unit: stocking.unit

                });

            }

        }


        result.push({

            id: stocking.id,

            category: stocking.category,

            totalQuantity: stocking.totalQuantity,

            unit: stocking.unit,

            costPerKg: stocking.costPerKg,

            siteId: stocking.siteId,

            site: stocking.site,

            farmId: stocking.farmId,

            createdAt: stocking.createdAt,

            stockingDate: stocking.createdAt,

            updatedAt: stocking.updatedAt,

            transfer: stocking.transfer ? {
                id: stocking.transfer.id,
                fromSiteId: stocking.transfer.fromSiteId,
                fromSiteName: stocking.transfer.fromSite?.siteName,
                quantity: stocking.transfer.quantity,
                unit: stocking.transfer.unit
            } : null,

            totalAllocated: stocking.siteId ? stocking.totalQuantity : totalAllocated,

            totalUsed,

            totalRemaining,

            unallocatedQuantity: stocking.siteId ? 0 : Math.max(stocking.totalQuantity - totalAllocated, 0),

            siteStock

        });

    }


    return result;

};


/*
 * Get Stock by ID
 */
export const getStockingById = async (
    userId,
    stockingId
) => {

    const farm =
        await getUserFarm(userId);


    const stocking =
        await prisma.stocking.findFirst({

            where: {

                id: stockingId,

                farmId: farm.id

            },

            include: {

                site: true,

                allocations: {

                    include: {

                        site: true

                    }

                }

            }

        });


    if (!stocking) {

        throw new Error("Stocking record not found.");

    }


    const targetSiteId = stocking.siteId || (stocking.allocations.length > 0 ? stocking.allocations[0].siteId : null);

    const totalUsed = targetSiteId
        ? await getSiteStockUsage(farm.id, targetSiteId, stocking.category)
        : 0;

    const totalAllocated = stocking.allocations.reduce(
        (sum, allocation) => sum + allocation.allocatedQuantity,
        0
    );

    const totalRemaining = Math.max(stocking.totalQuantity - totalUsed, 0);

    return {

        ...stocking,

        totalAllocated: stocking.siteId ? stocking.totalQuantity : totalAllocated,

        totalUsed,

        totalRemaining,

        unallocatedQuantity: stocking.siteId ? 0 : Math.max(stocking.totalQuantity - totalAllocated, 0)

    };

};


/*
 * Update Stock Quantity
 */
export const updateStocking = async (userId, stockingId, stockingData) => {

    const farm = await getUserFarm(userId);


    const stocking = await prisma.stocking.findFirst({

        where: {

            id: stockingId,

            farmId: farm.id

        }

    });


    if (!stocking) {

        throw new Error("Stocking record not found.");

    }


    const newTotalQuantity = parseFloat(stockingData.totalQuantity);

    if (isNaN(newTotalQuantity) || newTotalQuantity <= 0) {

        throw new Error("Valid positive total quantity is required.");

    }


    const updated = await prisma.stocking.update({

        where: { id: stocking.id },

        data: {

            ...(stockingData.siteId ? { siteId: stockingData.siteId } : {}),

            totalQuantity: newTotalQuantity,

            unit: stockingData.unit ? stockingData.unit.trim() : stocking.unit,

            ...(stockingData.costPerKg !== undefined ? { costPerKg: stockingData.costPerKg } : {}),

            ...(stockingData.stockingDate ? { createdAt: new Date(stockingData.stockingDate) } : {})

        },

        include: {

            site: true

        }

    });


    return updated;

};


/*
 * Delete Stock
 */
export const deleteStocking = async (userId, stockingId) => {

    const farm = await getUserFarm(userId);


    const stocking = await prisma.stocking.findFirst({

        where: {

            id: stockingId,

            farmId: farm.id

        },

        include: {

            transfer: {

                include: {

                    fromSite: true

                }

            }

        }

    });


    if (!stocking) {

        throw new Error("Stocking record not found.");

    }


    if (stocking.transfer) {

        const { fromSiteId, quantity: transferQty, fromSite } = stocking.transfer;

        const qtyToReturn = stocking.totalQuantity > 0 ? stocking.totalQuantity : transferQty;

        const sourceSiteName = fromSite?.siteName || "source site";


        return await prisma.$transaction(async (tx) => {

            const sourceStocking = await tx.stocking.findFirst({

                where: {

                    farmId: farm.id,

                    siteId: fromSiteId,

                    category: stocking.category,

                    transferId: null

                },

                orderBy: { createdAt: "desc" }

            });


            if (sourceStocking) {

                await tx.stocking.update({

                    where: { id: sourceStocking.id },

                    data: { totalQuantity: sourceStocking.totalQuantity + qtyToReturn }

                });

            } else {

                await tx.stocking.create({

                    data: {

                        category: stocking.category,

                        totalQuantity: qtyToReturn,

                        unit: stocking.unit,

                        siteId: fromSiteId,

                        farmId: farm.id

                    }

                });

            }


            await tx.stocking.delete({ where: { id: stocking.id } });

            await tx.stockTransfer.delete({ where: { id: stocking.transfer.id } });


            return {

                message: `${qtyToReturn} ${stocking.unit} ${stocking.category === "FEED" ? "Feed" : "Medicine"} returned to ${sourceSiteName} and removed from destination.`

            };

        });

    }


    await prisma.stocking.delete({

        where: { id: stocking.id }

    });


    return { message: "Stock record deleted successfully." };

};


/*
 * Legacy Allocation endpoints kept for 100% backward safety
 */
export const allocateStockToSite = async (userId, stockingId, allocationData) => {

    const farm = await getUserFarm(userId);


    const stocking = await prisma.stocking.findFirst({

        where: { id: stockingId, farmId: farm.id }

    });


    if (!stocking) {

        throw new Error("Stocking record not found.");

    }


    const site = await getUserSite(farm.id, allocationData.siteId);


    const allocation = await prisma.siteStockAllocation.create({

        data: {

            allocatedQuantity: allocationData.allocatedQuantity,

            unit: allocationData.unit ?? stocking.unit,

            stockingId: stocking.id,

            siteId: site.id

        },

        include: {

            site: true,

            stocking: true

        }

    });


    return allocation;

};


export const getSiteStockAllocations = async (userId, siteId) => {

    const farm = await getUserFarm(userId);


    const site = await getUserSite(farm.id, siteId);


    const allocations = await prisma.siteStockAllocation.findMany({

        where: {

            siteId: site.id,

            stocking: { farmId: farm.id }

        },

        include: {

            stocking: true,

            site: true

        }

    });


    return allocations;

};


export const updateSiteStockAllocation = async (userId, allocationId, allocationData) => {

    const farm = await getUserFarm(userId);


    const allocation = await prisma.siteStockAllocation.findFirst({

        where: { id: allocationId },

        include: { stocking: true }

    });


    if (!allocation || allocation.stocking.farmId !== farm.id) {

        throw new Error("Site stock allocation record not found.");

    }


    const updated = await prisma.siteStockAllocation.update({

        where: { id: allocation.id },

        data: {

            allocatedQuantity: parseFloat(allocationData.allocatedQuantity)

        },

        include: {

            site: true,

            stocking: true

        }

    });


    return updated;

};


export const deleteSiteStockAllocation = async (userId, allocationId) => {

    const farm = await getUserFarm(userId);


    const allocation = await prisma.siteStockAllocation.findFirst({

        where: { id: allocationId },

        include: { stocking: true }

    });


    if (!allocation || allocation.stocking.farmId !== farm.id) {

        throw new Error("Site stock allocation record not found.");

    }


    await prisma.siteStockAllocation.delete({

        where: { id: allocation.id }

    });


    return { message: "Site stock allocation deleted successfully." };

};


/*
 * Transfer Stock Between Sites
 */
export const transferStock = async (userId, transferData) => {
    const farm = await getUserFarm(userId);
    const { fromSiteId, toSiteId, category, quantity } = transferData;

    if (!fromSiteId || !toSiteId) {
        throw new Error("Both source site and destination site are required.");
    }

    if (fromSiteId === toSiteId) {
        throw new Error("Source site and destination site must be different.");
    }

    const catUpper = category ? category.toUpperCase() : "";
    if (catUpper !== "FEED" && catUpper !== "MEDICINE") {
        throw new Error("Stock category must be FEED or MEDICINE.");
    }

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
        throw new Error("Transfer quantity must be greater than 0.");
    }

    const fromSite = await getUserSite(farm.id, fromSiteId);
    const toSite = await getUserSite(farm.id, toSiteId);
    const unit = catUpper === "MEDICINE" ? "L" : "kg";

    const fromSiteStockings = await prisma.stocking.findMany({
        where: {
            farmId: farm.id,
            siteId: fromSite.id,
            category: catUpper
        },
        orderBy: { createdAt: "asc" }
    });

    const totalAddedAtFromSite = fromSiteStockings.reduce(
        (sum, s) => sum + s.totalQuantity,
        0
    );
    const totalUsedAtFromSite = await getSiteStockUsage(farm.id, fromSite.id, catUpper);
    const availableRemaining = Math.max(totalAddedAtFromSite - totalUsedAtFromSite, 0);

    if (parsedQty > availableRemaining) {
        throw new Error(
            `Insufficient ${catUpper === "FEED" ? "Feed" : "Medicine"} stock. Only ${availableRemaining} ${unit} is available for transfer.`
        );
    }

    return await prisma.$transaction(async (tx) => {
        let remainingToDeduct = parsedQty;

        for (const stocking of fromSiteStockings) {
            if (remainingToDeduct <= 0) break;
            const deductAmt = Math.min(stocking.totalQuantity, remainingToDeduct);
            const newQty = stocking.totalQuantity - deductAmt;

            await tx.stocking.update({
                where: { id: stocking.id },
                data: { totalQuantity: Math.max(newQty, 0) }
            });

            remainingToDeduct -= deductAmt;
        }

        const transferLog = await tx.stockTransfer.create({
            data: {
                category: catUpper,
                quantity: parsedQty,
                unit,
                fromSiteId: fromSite.id,
                toSiteId: toSite.id,
                farmId: farm.id
            }
        });

        await tx.stocking.create({
            data: {
                category: catUpper,
                totalQuantity: parsedQty,
                unit,
                siteId: toSite.id,
                farmId: farm.id,
                transferId: transferLog.id
            }
        });

        return {
            success: true,
            message: `${parsedQty} ${unit} ${catUpper === "FEED" ? "Feed" : "Medicine"} transferred from ${fromSite.siteName} to ${toSite.siteName}.`,
            data: transferLog
        };
    });
};