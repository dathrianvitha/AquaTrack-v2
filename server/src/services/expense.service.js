import prisma from "../config/prisma.js";

import {
    getUserFarm,
    getUserSite,
    getUserTank,
    getActiveCrop
} from "../utils/farm.helpers.js";

import {
    expenseCategories
} from "../validations/expense.validation.js";


const normalizePaymentMode = (mode) => {
    if (!mode) return "CASH";
    const upper = String(mode).toUpperCase().trim();
    if (upper.includes("UPI") || upper.includes("NET") || upper.includes("ONLINE") || upper.includes("BANK")) {
        return "UPI";
    }
    if (upper.includes("CARD")) {
        return "CARD";
    }
    return "CASH";
};

/*
 * Create Expense
 *
 * - Site-level categories: Split equally across all tanks in the site (or farm)
 *   that currently have ACTIVE crops. Each tank gets its equal share recorded
 *   so it displays accurately in tank-wise reports and expense history.
 * - Tank-level categories (e.g. Seed Cost): Associated with the tank's active crop.
 *   If the tank has no active crop yet, an active crop is automatically initialized
 *   so the expense is successfully registered.
 */
export const createExpense = async (
    userId,
    expenseData
) => {

    const farm = await getUserFarm(userId);

    const paymentMode = normalizePaymentMode(expenseData.paymentMode);

    const isSeedCost =
        expenseData.category === "Seed Cost" ||
        String(expenseData.category).toLowerCase().trim() === "seed cost";

    const isSiteLevel =
        !isSeedCost && (expenseData.siteId || !expenseData.tankId);

    /* ----------------------------------------------------
     * CASE 1: SITE-LEVEL EXPENSE
     * Divide equally across all tanks with ACTIVE crops
     * ---------------------------------------------------- */
    if (isSiteLevel) {
        let siteId = expenseData.siteId;

        if (!siteId && expenseData.tankId) {
            const tank = await prisma.tank.findFirst({
                where: {
                    id: expenseData.tankId,
                    site: {
                        farmId: farm.id
                    }
                }
            });
            if (tank) siteId = tank.siteId;
        }

        if (!siteId) {
            const firstSite = await prisma.site.findFirst({
                where: { farmId: farm.id }
            });
            if (firstSite) siteId = firstSite.id;
        }

        if (!siteId) {
            throw new Error("Site not found. Please create a site first.");
        }

        const site = await getUserSite(farm.id, siteId);

        // Find all tanks in this site that have ACTIVE crops
        let activeCrops = await prisma.crop.findMany({
            where: {
                status: "ACTIVE",
                tank: {
                    siteId: site.id
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

        // If none found in this site, check farm-wide active crops
        if (activeCrops.length === 0) {
            activeCrops = await prisma.crop.findMany({
                where: {
                    status: "ACTIVE",
                    tank: {
                        site: {
                            farmId: farm.id
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
        }

        // If still no active crops anywhere, check if tanks exist in the site and initialize active crop
        if (activeCrops.length === 0) {
            const availableTank = await prisma.tank.findFirst({
                where: {
                    siteId: site.id
                },
                include: {
                    site: true
                }
            });

            if (availableTank) {
                const autoCrop = await prisma.crop.create({
                    data: {
                        tankId: availableTank.id,
                        stockingDate: new Date(expenseData.date || Date.now()),
                        seedVariety: "General",
                        batchNumber: `Batch-${availableTank.tankName || "1"}`,
                        status: "ACTIVE",
                        notes: "Auto-created crop on site expense entry"
                    },
                    include: {
                        tank: {
                            include: {
                                site: true
                            }
                        }
                    }
                });
                activeCrops = [autoCrop];
            } else {
                throw new Error("No tanks found in this site. Please add a tank first.");
            }
        }

        const N = activeCrops.length;
        const totalAmount = parseFloat(expenseData.amount);
        const splitAmount = Math.round((totalAmount / N) * 100) / 100;

        const createdExpenses = [];

        for (let i = 0; i < N; i++) {
            const cropItem = activeCrops[i];
            const isLast = (i === N - 1);
            // Ensure sum of splits matches totalAmount exactly
            const itemAmount = isLast
                ? Math.round((totalAmount - splitAmount * (N - 1)) * 100) / 100
                : splitAmount;

            const splitNote = `[Site Split: Total ₹${totalAmount.toLocaleString()} split across ${N} active tank(s) - ${cropItem.tank.tankName}: ₹${itemAmount.toLocaleString()}]`;
            const finalNotes = expenseData.notes
                ? `${expenseData.notes} ${splitNote}`
                : splitNote;

            const created = await prisma.expense.create({
                data: {
                    cropId: cropItem.id,
                    category: expenseData.category,
                    description: expenseData.description || `${expenseData.category} (Site Split)`,
                    amount: itemAmount,
                    paymentMode: paymentMode,
                    receipt: null,
                    date: new Date(expenseData.date),
                    notes: finalNotes
                },
                include: {
                    crop: {
                        include: {
                            tank: {
                                include: {
                                    site: true
                                }
                            }
                        }
                    }
                }
            });

            createdExpenses.push(created);
        }

        return createdExpenses.length === 1 ? createdExpenses[0] : createdExpenses;
    }

    /* ----------------------------------------------------
     * CASE 2: TANK-LEVEL EXPENSE (e.g. Seed Cost)
     * ---------------------------------------------------- */
    let tank;

    if (expenseData.tankId) {
        tank = await prisma.tank.findFirst({
            where: {
                id: expenseData.tankId,
                site: {
                    farmId: farm.id
                }
            },
            include: {
                site: true
            }
        });
    }

    if (!tank && expenseData.siteId) {
        tank = await prisma.tank.findFirst({
            where: {
                siteId: expenseData.siteId,
                site: {
                    farmId: farm.id
                }
            },
            include: {
                site: true
            }
        });
    }

    if (!tank && expenseData.tankId) {
        tank = await getUserTank(
            farm.id,
            expenseData.tankId
        );
    }

    if (!tank) {
        throw new Error("Tank or Site not found.");
    }

    let crop = await prisma.crop.findFirst({
        where: {
            tankId: tank.id,
            status: "ACTIVE"
        }
    });

    // Auto-create active crop if none exists for this tank so user can proceed
    if (!crop) {
        crop = await prisma.crop.create({
            data: {
                tankId: tank.id,
                stockingDate: new Date(expenseData.date || Date.now()),
                seedVariety: isSeedCost ? "Stocked Seed" : "General",
                batchNumber: `Batch-${tank.tankName || "1"}`,
                status: "ACTIVE",
                notes: `Auto-started crop for ${tank.tankName} on ${expenseData.category} recording`
            },
            include: {
                tank: {
                    include: {
                        site: true
                    }
                }
            }
        });
    }

    const expense = await prisma.expense.create({
        data: {
            cropId: crop.id,
            category: expenseData.category,
            description: expenseData.description || expenseData.category,
            amount: parseFloat(expenseData.amount),
            paymentMode: paymentMode,
            receipt: null,
            date: new Date(expenseData.date),
            notes: expenseData.notes ?? null
        },
        include: {
            crop: {
                include: {
                    tank: {
                        include: {
                            site: true
                        }
                    }
                }
            }
        }
    });

    return expense;
};


/*
 * Get all Expenses
 */
export const getExpenses = async (
    userId
) => {

    const farm =
        await getUserFarm(userId);


    const expenses =
        await prisma.expense.findMany({

            where: {

                crop: {

                    tank: {

                        site: {

                            farmId:
                                farm.id

                        }

                    }

                }

            },

            include: {

                crop: {

                    include: {

                        tank: {
                            include: {
                                site: true
                            }
                        }

                    }

                }

            },

            orderBy: {

                date: "desc"

            }

        });


    return expenses;

};


/*
 * Get Expense by ID
 */
export const getExpenseById = async (
    userId,
    expenseId
) => {

    const farm =
        await getUserFarm(userId);


    const expense =
        await prisma.expense.findFirst({

            where: {

                id:
                    expenseId,

                crop: {

                    tank: {

                        site: {

                            farmId:
                                farm.id

                        }

                    }

                }

            },

            include: {

                crop: {

                    include: {

                        tank: {
                            include: {
                                site: true
                            }
                        }

                    }

                }

            }

        });


    if (!expense) {

        throw new Error(
            "Expense not found."
        );

    }


    return expense;

};


/*
 * Update Expense
 */
export const updateExpense = async (
    userId,
    expenseId,
    expenseData
) => {

    /*
     * Verify that the Expense belongs
     * to the logged-in user's Farm.
     */
    await getExpenseById(

        userId,

        expenseId

    );


    const updateData = {

        ...expenseData

    };


    /*
     * Convert date string to Date.
     */
    if (updateData.date) {

        updateData.date =
            new Date(
                updateData.date
            );

    }

    if (updateData.paymentMode) {
        updateData.paymentMode = normalizePaymentMode(updateData.paymentMode);
    }

    if (updateData.amount) {
        updateData.amount = parseFloat(updateData.amount);
    }

    delete updateData.tankId;
    delete updateData.siteId;


    const expense =
        await prisma.expense.update({

            where: {

                id:
                    expenseId

            },

            data:
                updateData,

            include: {
                crop: {
                    include: {
                        tank: {
                            include: {
                                site: true
                            }
                        }
                    }
                }
            }

        });


    return expense;

};


/*
 * Delete Expense
 */
export const deleteExpense = async (
    userId,
    expenseId
) => {

    await getExpenseById(

        userId,

        expenseId

    );


    await prisma.expense.delete({

        where: {

            id:
                expenseId

        }

    });


    return {

        message:
            "Expense deleted successfully."

    };

};


/*
 * Get Expense Categories
 *
 * Uses the same category list from
 * expense.validation.js.
 *
 * Current categories:
 *
 * Pond Lease
 * Pond Preparation
 * Seed Cost
 * Electricity
 * Generator & Diesel
 * Labour
 * Maintenance
 * Salaries
 */
export const getExpenseCategories = async () => {

    return expenseCategories;

};


/*
 * Get Expense Summary
 */
export const getExpenseSummary = async (
    userId
) => {

    const farm =
        await getUserFarm(userId);


    const expenses =
        await prisma.expense.findMany({

            where: {

                crop: {

                    tank: {

                        site: {

                            farmId:
                                farm.id

                        }

                    }

                }

            }

        });


    const totalExpenses =
        expenses.reduce(

            (sum, item) =>
                sum + item.amount,

            0

        );


    const categoryWise = {};


    expenses.forEach(
        (expense) => {

            categoryWise[
                expense.category
            ] =

                (
                    categoryWise[
                        expense.category
                    ] || 0
                ) +

                expense.amount;

        }
    );


    return {

        totalExpenses,

        totalEntries:
            expenses.length,

        categoryWise

    };

};