import prisma from "../config/prisma.js";

import { getUserFarm } from "../utils/farm.helpers.js";

export const getDashboard = async (userId) => {

    const farm = await getUserFarm(userId);

    const tanks = await prisma.tank.findMany({
        where: {
            site: {
                farmId: farm.id
            }
        }
    });

    const activeCrops = await prisma.crop.findMany({
        where: {
            tank: {
                site: {
                    farmId: farm.id
                }
            },
            status: "ACTIVE"
        },
        include: {
            tank: true
        }
    });

    const completedCropsData = await prisma.crop.findMany({
        where: {
            tank: {
                site: {
                    farmId: farm.id
                }
            },
            status: "COMPLETED"
        },
        include: {
            tank: true,
            feedEntries: true,
            harvests: true
        },
        orderBy: {
            updatedAt: "desc"
        }
    });

    const completedCrops = completedCropsData.length;

    let totalCompletedFeedWeight = 0;
    let totalCompletedHarvestWeight = 0;

    const completedBatches = completedCropsData.map((crop) => {
        const cumulativeFeedWeight = (crop.feedEntries || []).reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
        );

        const totalHarvestWeight = (crop.harvests || []).reduce(
            (sum, item) => sum + (Number(item.harvestWeight) || 0),
            0
        );

        totalCompletedFeedWeight += cumulativeFeedWeight;
        totalCompletedHarvestWeight += totalHarvestWeight;

        const fcr = totalHarvestWeight > 0
            ? Number((cumulativeFeedWeight / totalHarvestWeight).toFixed(2))
            : 0;

        return {
            cropId: crop.id,
            cropName: crop.cropName,
            batchNumber: crop.batchNumber,
            tankId: crop.tankId,
            tankName: crop.tank?.tankName || "Tank",
            stockingDate: crop.stockingDate,
            cumulativeFeedWeight: Number(cumulativeFeedWeight.toFixed(2)),
            totalHarvestWeight: Number(totalHarvestWeight.toFixed(2)),
            fcrRatio: fcr.toFixed(2)
        };
    });

    const overallFcr = totalCompletedHarvestWeight > 0
        ? (totalCompletedFeedWeight / totalCompletedHarvestWeight).toFixed(2)
        : "0.00";

    const feedEntries = await prisma.feedEntry.findMany({
        where: {
            crop: {
                tank: {
                    site: {
                        farmId: farm.id
                    }
                }
            }
        }
    });

    const expenses = await prisma.expense.findMany({
        where: {
            crop: {
                tank: {
                    site: {
                        farmId: farm.id
                    }
                }
            }
        }
    });

    const medicines = await prisma.medicine.findMany({
        where: {
            tank: {
                site: {
                    farmId: farm.id
                }
            }
        }
    });

    const harvests = await prisma.harvest.findMany({
        where: {
            crop: {
                tank: {
                    site: {
                        farmId: farm.id
                    }
                }
            }
        }
    });

    const totalFeedCost = feedEntries.reduce(
        (sum, item) => sum + item.totalCost,
        0
    );

    const totalExpenseCost = expenses.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    const totalMedicineCost = medicines.reduce(
        (sum, item) => sum + item.cost,
        0
    );

    const totalRevenue = harvests.reduce(
        (sum, item) => sum + item.revenue,
        0
    );

    const totalProfit = harvests.reduce(
        (sum, item) => sum + item.profit,
        0
    );

    const cropOverview = activeCrops.map(crop => {

        const today = new Date();

        const daysRunning = Math.floor(

            (today - crop.stockingDate) /

            (1000 * 60 * 60 * 24)

        );

        const daysRemaining = Math.max(

            crop.cropDuration - daysRunning,

            0

        );

        return {

            cropId: crop.id,

            cropName: crop.cropName,

            tankName: crop.tank.tankName,

            stockingDate: crop.stockingDate,

            expectedHarvestDate: crop.expectedHarvestDate,

            currentDay: daysRunning,

            daysRemaining

        };

    });

    return {

        farm: {

            id: farm.id,

            farmName: farm.farmName,

            ownerName: farm.ownerName,

            totalAcres: farm.totalAcres

        },

        statistics: {
            totalTanks: tanks.length,
            activeCrops: activeCrops.length,
            completedCrops,
            fcrRatio: overallFcr,
            completedBatches
        },
        completedBatches,

        finance: {

            totalFeedCost,

            totalExpenseCost,

            totalMedicineCost,

            totalRevenue,

            totalProfit

        },

        counts: {

            feedEntries: feedEntries.length,

            expenses: expenses.length,

            medicines: medicines.length,

            harvests: harvests.length

        },

        activeCropOverview: cropOverview

    };

};