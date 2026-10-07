import prisma from "../config/prisma.js";

import {
    getUserFarm,
    getUserTank
} from "../utils/farm.helpers.js";

/* ---------------------------------------------
   Helper: Build Date Range Filter
----------------------------------------------*/
export const buildDateFilter = (fromDate, toDate) => {
    if (!fromDate && !toDate) return null;
    const filter = {};
    if (fromDate) {
        let start;
        if (typeof fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
            start = new Date(`${fromDate}T00:00:00.000Z`);
        } else {
            start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
        }
        if (!isNaN(start.getTime())) {
            filter.gte = start;
        }
    }
    if (toDate) {
        let end;
        if (typeof toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            end = new Date(`${toDate}T23:59:59.999Z`);
        } else {
            end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
        }
        if (!isNaN(end.getTime())) {
            filter.lte = end;
        }
    }
    return Object.keys(filter).length > 0 ? filter : null;
};

/* ---------------------------------------------
   Get all tanks for Reports page
----------------------------------------------*/

export const getReportTanks = async (userId) => {

    const farm = await getUserFarm(userId);

    const tanks = await prisma.tank.findMany({

        where: {

            site: {

                farmId: farm.id

            }

        },

        select: {

            id: true,

            tankName: true,

            area: true,

            depth: true,

            waterSource: true,

            siteId: true,

            site: {

                select: {

                    id: true,

                    siteName: true

                }

            }

        },

        orderBy: {

            tankName: "asc"

        }

    });

    return tanks;

};

/* ---------------------------------------------
   Get Active Crop Report
----------------------------------------------*/

export const getActiveTankReport = async (

    userId,

    tankId,

    dateFilter = {}

) => {

    const farm = await getUserFarm(userId);

    const tank = await getUserTank(

        farm.id,

        tankId

    );

    const crop = await prisma.crop.findFirst({

        where: {

            tankId: tank.id,

            status: "ACTIVE"

        }

    });

    if (!crop) {

        throw new Error("No active crop found for this tank.");

    }

    return await buildReport(

        tank,

        crop,

        dateFilter

    );

};

/* ---------------------------------------------
   Get Completed Crops List
----------------------------------------------*/

export const getCompletedCrops = async (

    userId,

    tankId

) => {

    const farm = await getUserFarm(userId);

    const tank = await getUserTank(

        farm.id,

        tankId

    );

    const completedCrops = await prisma.crop.findMany({

        where: {

            tankId: tank.id,

            status: "COMPLETED"

        },

        select: {
            id: true,
            cropName: true,
            batchNumber: true,
            stockingDate: true,
            expectedHarvestDate: true,
            cropDuration: true
        },

        orderBy: {

            stockingDate: "desc"

        }

    });

    return completedCrops;

};

/* ---------------------------------------------
   Get Completed Crop Report
----------------------------------------------*/

export const getCompletedCropReport = async (

    userId,

    cropId,

    dateFilter = {}

) => {

    const farm = await getUserFarm(userId);

    const crop = await prisma.crop.findFirst({

        where: {

            id: cropId,

            tank: {

                site: {

                    farmId: farm.id

                }

            }

        },

        include: {

            tank: true

        }

    });

    if (!crop) {

        throw new Error("Crop not found.");

    }

    return await buildReport(

        crop.tank,

        crop,

        dateFilter

    );

};

/* ---------------------------------------------
   Helper: Calculate Crop Pond Lease Cost
----------------------------------------------*/
const getCropPondLeaseCost = async (tankId, crop, dateRange = null) => {
    const directWhere = { tankId };
    if (dateRange) {
        directWhere.leaseStartDate = dateRange;
    }

    // 1. Check direct leases for this tank
    let pondLeases = await prisma.pondLease.findMany({
        where: directWhere
    });

    if (pondLeases && pondLeases.length > 0) {
        return pondLeases.reduce((sum, l) => sum + (parseFloat(l.totalLeaseAmount) || 0), 0);
    }

    // 2. If no direct lease on this tank, check if any lease was recorded for tanks in the same site
    const currentTank = await prisma.tank.findUnique({
        where: { id: tankId },
        include: { site: true }
    });

    if (currentTank?.siteId) {
        const siteWhere = {
            tank: {
                siteId: currentTank.siteId
            }
        };
        if (dateRange) {
            siteWhere.leaseStartDate = dateRange;
        }
        const siteLeases = await prisma.pondLease.findMany({
            where: siteWhere
        });

        if (siteLeases && siteLeases.length > 0) {
            const tanksInSite = await prisma.tank.count({
                where: { siteId: currentTank.siteId }
            });
            const tankCount = Math.max(1, tanksInSite);
            const totalSiteLease = siteLeases.reduce((sum, l) => sum + (parseFloat(l.totalLeaseAmount) || 0), 0);
            return Math.round((totalSiteLease / tankCount) * 100) / 100;
        }
    }

    return 0;
};

/* ---------------------------------------------
   Shared Report Builder
----------------------------------------------*/

const buildReport = async (

    tank,

    crop,

    dateFilter = {}

) => {

    const dateRange = buildDateFilter(dateFilter?.fromDate, dateFilter?.toDate);

    const feedWhere = { cropId: crop.id };
    if (dateRange) feedWhere.date = dateRange;

    const feedEntries = await prisma.feedEntry.findMany({

        where: feedWhere,

        orderBy: {

            date: "desc"

        }

    });

    const medicineWhere = { tankId: tank.id };
    if (dateRange) medicineWhere.date = dateRange;

    const medicines = await prisma.medicine.findMany({

        where: medicineWhere,

        orderBy: {

            date: "desc"

        }

    });

    const expenseWhere = { cropId: crop.id };
    if (dateRange) expenseWhere.date = dateRange;

    const expenses = await prisma.expense.findMany({

        where: expenseWhere,

        orderBy: {

            date: "desc"

        }

    });

    const totalPondLeaseCost = await getCropPondLeaseCost(tank.id, crop, dateRange);

    const totalFeedCost = feedEntries.reduce(

        (sum, item) => sum + item.totalCost,

        0

    );

    const totalMedicineCost = medicines.reduce(

        (sum, item) => sum + item.cost,

        0

    );

    const totalExpenseCost = expenses.reduce(

        (sum, item) => sum + item.amount,

        0

    );

    const totalExpenses =

        totalFeedCost +

        totalMedicineCost +

        totalExpenseCost +

        totalPondLeaseCost;

    const categoryBreakdown = {};

    expenses.forEach(expense => {

        if (!categoryBreakdown[expense.category]) {

            categoryBreakdown[expense.category] = 0;

        }

        categoryBreakdown[expense.category] += expense.amount;

    });

    if (totalFeedCost > 0) {
        categoryBreakdown["Feed"] = totalFeedCost;
    }

    if (totalMedicineCost > 0) {
        categoryBreakdown["Medicine"] = totalMedicineCost;
    }

    if (totalPondLeaseCost > 0) {
        categoryBreakdown["Pond Lease"] = (categoryBreakdown["Pond Lease"] || 0) + totalPondLeaseCost;
    }

    const pieChartData = Object.entries(

        categoryBreakdown

    ).filter(([_, amount]) => amount > 0)
    .map(

        ([category, amount]) => ({

            category,

            amount: Math.round(amount * 100) / 100

        })

    );

    const today = new Date();

    const currentDay = Math.floor(

        (today - crop.stockingDate) /

        (1000 * 60 * 60 * 24)

    );

    const harvestWhere = { cropId: crop.id };
    if (dateRange) harvestWhere.harvestDate = dateRange;

    const harvests = await prisma.harvest.findMany({
        where: harvestWhere,
        orderBy: [
            { harvestNumber: "asc" },
            { harvestDate: "asc" }
        ]
    });

    const totalHarvestWeight = harvests.reduce(
        (sum, h) => sum + (h.harvestWeight || h.production || 0),
        0
    );

    const totalHarvestRevenue = harvests.reduce(
        (sum, h) => sum + (h.revenue || 0),
        0
    );

    return {

        tank: {

            id: tank.id,

            tankName: tank.tankName,

            area: tank.area,

            depth: tank.depth,

            waterSource: tank.waterSource

        },

        crop: {
            id: crop.id,
            cropName: crop.cropName,
            batchNumber: crop.batchNumber,
            status: crop.status,
            stockingDate: crop.stockingDate,
            expectedHarvestDate: crop.expectedHarvestDate,
            cropDuration: crop.cropDuration,
            currentDay:
                crop.status === "ACTIVE"
                    ? currentDay
                    : crop.cropDuration
        },

        summary: {

            totalFeedCost,

            totalMedicineCost,

            totalExpenseCost,

            totalPondLeaseCost,

            totalExpenses,

            totalHarvestWeight,

            totalHarvestRevenue,

            totalHarvestsCount: harvests.length

        },

        expenseBreakdown: pieChartData,

        feedHistory: feedEntries,

        medicineHistory: medicines,

        expenseHistory: totalPondLeaseCost > 0
            ? [
                {
                    id: `lease-${tank.id}`,
                    category: "Pond Lease",
                    description: `Pond Lease Allocation (${tank.tankName})`,
                    amount: totalPondLeaseCost,
                    paymentMode: "BANK",
                    date: crop.stockingDate,
                    notes: `Pond lease allocation of ₹${totalPondLeaseCost.toLocaleString()} for culture period`
                },
                ...expenses
            ]
            : expenses,

        harvestHistory: harvests

    };

};

/* ---------------------------------------------
   Get Comprehensive Farm Overview Report
   Aggregates all crops, feed, expenses, leases, and harvests
----------------------------------------------*/
export const getFarmOverviewReport = async (userId, dateFilter = {}) => {
    const farm = await getUserFarm(userId);
    const dateRange = buildDateFilter(dateFilter?.fromDate, dateFilter?.toDate);

    const feedInclude = dateRange ? { where: { date: dateRange }, orderBy: { date: "desc" } } : { orderBy: { date: "desc" } };
    const expenseInclude = dateRange ? { where: { date: dateRange }, orderBy: { date: "desc" } } : { orderBy: { date: "desc" } };
    const harvestInclude = dateRange ? { where: { harvestDate: dateRange }, orderBy: [{ harvestNumber: "asc" }, { harvestDate: "asc" }] } : { orderBy: [{ harvestNumber: "asc" }, { harvestDate: "asc" }] };

    const crops = await prisma.crop.findMany({
        where: {
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
            },
            feedEntries: feedInclude,
            expenses: expenseInclude,
            harvests: harvestInclude
        }
    });

    const medicineWhere = {
        tank: {
            site: {
                farmId: farm.id
            }
        },
        ...(dateRange ? { date: dateRange } : {})
    };

    const medicines = await prisma.medicine.findMany({
        where: medicineWhere,
        orderBy: { date: "desc" }
    });

    const leaseWhere = {
        tank: {
            site: {
                farmId: farm.id
            }
        },
        ...(dateRange ? { leaseStartDate: dateRange } : {})
    };

    const pondLeases = await prisma.pondLease.findMany({
        where: leaseWhere,
        include: {
            tank: true
        }
    });

    const allFeedEntries = crops.flatMap(c => c.feedEntries).sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalFeedCost = allFeedEntries.reduce((sum, f) => sum + (f.totalCost || 0), 0);

    const allExpenses = crops.flatMap(c => c.expenses).sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalExpenseCost = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (m.cost || 0), 0);
    const totalPondLeaseCost = pondLeases.reduce((sum, l) => sum + (parseFloat(l.totalLeaseAmount) || 0), 0);
    const totalExpenses = totalFeedCost + totalMedicineCost + totalExpenseCost + totalPondLeaseCost;

    const allHarvests = crops.flatMap(c => c.harvests).sort((a, b) => new Date(b.harvestDate) - new Date(a.harvestDate));
    const totalHarvestWeight = allHarvests.reduce((sum, h) => sum + (h.harvestWeight || h.production || 0), 0);
    const totalHarvestRevenue = allHarvests.reduce((sum, h) => sum + (h.revenue || 0), 0);

    const categoryBreakdown = {};
    allExpenses.forEach(exp => {
        categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + exp.amount;
    });

    if (totalFeedCost > 0) categoryBreakdown["Feed"] = totalFeedCost;
    if (totalMedicineCost > 0) categoryBreakdown["Medicine"] = totalMedicineCost;
    if (totalPondLeaseCost > 0) categoryBreakdown["Pond Lease"] = (categoryBreakdown["Pond Lease"] || 0) + totalPondLeaseCost;

    const pieChartData = Object.entries(categoryBreakdown)
        .filter(([_, amount]) => amount > 0)
        .map(([category, amount]) => ({
            category,
            amount: Math.round(amount * 100) / 100
        }));

    const leaseHistoryItems = pondLeases.map(l => ({
        id: `lease-${l.id}`,
        category: "Pond Lease",
        description: `Pond Lease (${l.tank?.tankName || 'Pond'})`,
        amount: l.totalLeaseAmount,
        paymentMode: "BANK",
        date: l.leaseStartDate,
        notes: `Total registered lease of ₹${l.totalLeaseAmount.toLocaleString()} for ${l.tank?.tankName || 'Pond'}`
    }));

    const allTanks = await prisma.tank.findMany({
        where: {
            site: {
                farmId: farm.id
            }
        }
    });
    const totalAcres = allTanks.reduce((sum, t) => sum + (t.area || 0), 0);

    return {
        isFarmOverview: true,
        tank: {
            id: 'ALL',
            tankName: 'All Ponds (Farm Total)',
            area: totalAcres || farm.totalAcres || 0,
            depth: 6,
            waterSource: 'Multiple'
        },
        crop: {
            id: 'ALL',
            cropName: `${farm.farmName || 'Farm'} Overall Analytics`,
            batchNumber: 'All Batches',
            status: 'ACTIVE',
            stockingDate: allFeedEntries[0]?.date || new Date(),
            cropDuration: 120,
            currentDay: null
        },
        summary: {
            totalFeedCost,
            totalMedicineCost,
            totalExpenseCost,
            totalPondLeaseCost,
            totalExpenses,
            totalHarvestWeight,
            totalHarvestRevenue,
            totalHarvestsCount: allHarvests.length
        },
        expenseBreakdown: pieChartData,
        feedHistory: allFeedEntries,
        medicineHistory: medicines,
        expenseHistory: [...allExpenses, ...leaseHistoryItems],
        harvestHistory: allHarvests
    };
};

/* ---------------------------------------------
   Get Comprehensive Site Overview Report
   Aggregates crops, feed, expenses, leases, and harvests for a specific site
----------------------------------------------*/
export const getSiteOverviewReport = async (userId, siteId, dateFilter = {}) => {
    const farm = await getUserFarm(userId);
    const dateRange = buildDateFilter(dateFilter?.fromDate, dateFilter?.toDate);

    const site = await prisma.site.findFirst({
        where: {
            id: siteId,
            farmId: farm.id
        },
        include: {
            tanks: true
        }
    });

    if (!site) {
        throw new Error("Site not found or does not belong to your farm.");
    }

    const feedInclude = dateRange ? { where: { date: dateRange }, orderBy: { date: "desc" } } : { orderBy: { date: "desc" } };
    const expenseInclude = dateRange ? { where: { date: dateRange }, orderBy: { date: "desc" } } : { orderBy: { date: "desc" } };
    const harvestInclude = dateRange ? { where: { harvestDate: dateRange }, orderBy: [{ harvestNumber: "asc" }, { harvestDate: "asc" }] } : { orderBy: [{ harvestNumber: "asc" }, { harvestDate: "asc" }] };

    const crops = await prisma.crop.findMany({
        where: {
            tank: {
                siteId: site.id
            }
        },
        include: {
            tank: {
                include: {
                    site: true
                }
            },
            feedEntries: feedInclude,
            expenses: expenseInclude,
            harvests: harvestInclude
        }
    });

    const medicineWhere = {
        tank: {
            siteId: site.id
        },
        ...(dateRange ? { date: dateRange } : {})
    };

    const medicines = await prisma.medicine.findMany({
        where: medicineWhere,
        orderBy: { date: "desc" }
    });

    const leaseWhere = {
        tank: {
            siteId: site.id
        },
        ...(dateRange ? { leaseStartDate: dateRange } : {})
    };

    const pondLeases = await prisma.pondLease.findMany({
        where: leaseWhere,
        include: {
            tank: true
        }
    });

    const allFeedEntries = crops.flatMap(c => c.feedEntries).sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalFeedCost = allFeedEntries.reduce((sum, f) => sum + (f.totalCost || 0), 0);

    const allExpenses = crops.flatMap(c => c.expenses).sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalExpenseCost = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalMedicineCost = medicines.reduce((sum, m) => sum + (m.cost || 0), 0);
    const totalPondLeaseCost = pondLeases.reduce((sum, l) => sum + (parseFloat(l.totalLeaseAmount) || 0), 0);
    const totalExpenses = totalFeedCost + totalMedicineCost + totalExpenseCost + totalPondLeaseCost;

    const allHarvests = crops.flatMap(c => c.harvests).sort((a, b) => new Date(b.harvestDate) - new Date(a.harvestDate));
    const totalHarvestWeight = allHarvests.reduce((sum, h) => sum + (h.harvestWeight || h.production || 0), 0);
    const totalHarvestRevenue = allHarvests.reduce((sum, h) => sum + (h.revenue || 0), 0);

    const categoryBreakdown = {};
    allExpenses.forEach(exp => {
        categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + exp.amount;
    });

    if (totalFeedCost > 0) categoryBreakdown["Feed"] = totalFeedCost;
    if (totalMedicineCost > 0) categoryBreakdown["Medicine"] = totalMedicineCost;
    if (totalPondLeaseCost > 0) categoryBreakdown["Pond Lease"] = (categoryBreakdown["Pond Lease"] || 0) + totalPondLeaseCost;

    const pieChartData = Object.entries(categoryBreakdown)
        .filter(([_, amount]) => amount > 0)
        .map(([category, amount]) => ({
            category,
            amount: Math.round(amount * 100) / 100
        }));

    const leaseHistoryItems = pondLeases.map(l => ({
        id: `lease-${l.id}`,
        category: "Pond Lease",
        description: `Pond Lease (${l.tank?.tankName || 'Pond'})`,
        amount: l.totalLeaseAmount,
        paymentMode: "BANK",
        date: l.leaseStartDate,
        notes: `Total registered lease of ₹${l.totalLeaseAmount.toLocaleString()} for ${l.tank?.tankName || 'Pond'}`
    }));

    const totalSiteAcres = site.tanks.reduce((sum, t) => sum + (t.area || 0), 0);
    const activeCropsCount = crops.filter(c => c.status === 'ACTIVE').length;
    const completedCropsCount = crops.filter(c => c.status === 'COMPLETED').length;

    return {
        isSiteOverview: true,
        site: {
            id: site.id,
            siteName: site.siteName,
            location: site.location,
            area: site.area || totalSiteAcres,
            tankCount: site.tanks.length,
            activeCropsCount,
            completedCropsCount
        },
        tank: {
            id: site.id,
            tankName: `${site.siteName} (Site Overview)`,
            area: site.area || totalSiteAcres || 0,
            depth: 6,
            waterSource: 'Site Ponds'
        },
        crop: {
            id: site.id,
            cropName: `${site.siteName} Consolidated Analytics`,
            batchNumber: 'Site Batches',
            status: 'ACTIVE',
            stockingDate: allFeedEntries[0]?.date || new Date(),
            cropDuration: 120,
            currentDay: null
        },
        summary: {
            totalFeedCost,
            totalMedicineCost,
            totalExpenseCost,
            totalPondLeaseCost,
            totalExpenses,
            totalHarvestWeight,
            totalHarvestRevenue,
            totalHarvestsCount: allHarvests.length
        },
        expenseBreakdown: pieChartData,
        feedHistory: allFeedEntries,
        medicineHistory: medicines,
        expenseHistory: [...allExpenses, ...leaseHistoryItems],
        harvestHistory: allHarvests
    };
};