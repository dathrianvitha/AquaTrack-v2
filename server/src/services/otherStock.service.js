import prisma from "../config/prisma.js";
import { getUserFarm } from "../utils/farm.helpers.js";

/*
 * Get all Other Stock records for logged-in user's farm
 */
export const getOtherStocksService = async (userId) => {
  const farm = await getUserFarm(userId);

  return prisma.otherStock.findMany({
    where: {
      farmId: farm.id
    },
    include: {
      site: {
        select: {
          id: true,
          siteName: true,
          location: true
        }
      },
      transfer: {
        include: {
          fromSite: {
            select: {
              id: true,
              siteName: true
            }
          },
          toSite: {
            select: {
              id: true,
              siteName: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
};

/*
 * Create a new Other Stock record
 */
export const createOtherStockService = async (userId, data) => {
  const farm = await getUserFarm(userId);

  return prisma.otherStock.create({
    data: {
      category: data.category,
      count: parseInt(data.count, 10),
      notes: data.notes || null,
      siteId: data.siteId || null,
      farmId: farm.id
    },
    include: {
      site: {
        select: {
          id: true,
          siteName: true,
          location: true
        }
      }
    }
  });
};

/*
 * Update an existing Other Stock record
 */
export const updateOtherStockService = async (userId, id, data) => {
  const farm = await getUserFarm(userId);

  const existing = await prisma.otherStock.findFirst({
    where: {
      id,
      farmId: farm.id
    }
  });

  if (!existing) {
    throw new Error("Other Stock record not found or access denied.");
  }

  const updateData = {};
  if (data.category) updateData.category = data.category;
  if (data.count !== undefined) updateData.count = parseInt(data.count, 10);
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.siteId !== undefined) updateData.siteId = data.siteId || null;

  return prisma.otherStock.update({
    where: {
      id
    },
    data: updateData,
    include: {
      site: {
        select: {
          id: true,
          siteName: true,
          location: true
        }
      },
      transfer: {
        include: {
          fromSite: {
            select: {
              id: true,
              siteName: true
            }
          },
          toSite: {
            select: {
              id: true,
              siteName: true
            }
          }
        }
      }
    }
  });
};

/*
 * Transfer Other Stock between sites (Atomic Transaction)
 */
export const transferOtherStockService = async (userId, { fromSiteId, toSiteId, category, count }) => {
  const farm = await getUserFarm(userId);

  if (!fromSiteId || !toSiteId) {
    throw new Error("Source site and destination site are required.");
  }

  if (fromSiteId === toSiteId) {
    throw new Error("Source site and destination site must be different.");
  }

  const transferCount = parseInt(count, 10);
  if (isNaN(transferCount) || transferCount <= 0) {
    throw new Error("Transfer quantity must be a positive whole number.");
  }

  // Verify both sites exist and belong to user's farm
  const [fromSite, toSite] = await Promise.all([
    prisma.site.findFirst({ where: { id: fromSiteId, farmId: farm.id } }),
    prisma.site.findFirst({ where: { id: toSiteId, farmId: farm.id } })
  ]);

  if (!fromSite) {
    throw new Error("Source site not found or access denied.");
  }
  if (!toSite) {
    throw new Error("Destination site not found or access denied.");
  }

  return prisma.$transaction(async (tx) => {
    // Fetch all stock records for category at source site
    const sourceStocks = await tx.otherStock.findMany({
      where: {
        siteId: fromSiteId,
        category,
        farmId: farm.id
      },
      orderBy: [
        { transferId: "asc" }, // direct stock (null transferId) first
        { createdAt: "desc" }
      ]
    });

    const totalAvailable = sourceStocks.reduce((sum, s) => sum + s.count, 0);
    if (totalAvailable < transferCount) {
      throw new Error(
        `Insufficient ${category} stock at ${fromSite.siteName}. Available: ${totalAvailable}, requested: ${transferCount}.`
      );
    }

    // Deduct quantity from source stock records
    let remainingToDeduct = transferCount;
    for (const stockRecord of sourceStocks) {
      if (remainingToDeduct <= 0) break;

      const deduct = Math.min(stockRecord.count, remainingToDeduct);
      const newCount = stockRecord.count - deduct;
      remainingToDeduct -= deduct;

      if (newCount === 0 && !stockRecord.transferId) {
        // Delete empty direct stock record
        await tx.otherStock.delete({ where: { id: stockRecord.id } });
      } else {
        await tx.otherStock.update({
          where: { id: stockRecord.id },
          data: { count: newCount }
        });
      }
    }

    // Create transfer log
    const transferLog = await tx.otherStockTransfer.create({
      data: {
        category,
        quantity: transferCount,
        fromSiteId,
        toSiteId,
        farmId: farm.id
      }
    });

    // Create destination stock record linked to transfer
    const destinationStock = await tx.otherStock.create({
      data: {
        category,
        count: transferCount,
        siteId: toSiteId,
        farmId: farm.id,
        transferId: transferLog.id
      },
      include: {
        site: {
          select: { id: true, siteName: true, location: true }
        },
        transfer: {
          include: {
            fromSite: { select: { id: true, siteName: true } },
            toSite: { select: { id: true, siteName: true } }
          }
        }
      }
    });

    return {
      message: `Successfully transferred ${transferCount} ${category} from ${fromSite.siteName} to ${toSite.siteName}.`,
      transfer: transferLog,
      destinationStock
    };
  });
};

/*
 * Delete an Other Stock record (Reverses transfer if stock was received via transfer)
 */
export const deleteOtherStockService = async (userId, id) => {
  const farm = await getUserFarm(userId);

  const existing = await prisma.otherStock.findFirst({
    where: {
      id,
      farmId: farm.id
    },
    include: {
      transfer: true
    }
  });

  if (!existing) {
    throw new Error("Other Stock record not found or access denied.");
  }

  // If this stock record was received via a transfer, reverse it automatically
  if (existing.transfer) {
    const { fromSiteId, quantity, category } = existing.transfer;

    return prisma.$transaction(async (tx) => {
      // Find an existing direct (non-transferred) stock record at source site
      const sourceDirectStock = await tx.otherStock.findFirst({
        where: {
          siteId: fromSiteId,
          category,
          farmId: farm.id,
          transferId: null
        }
      });

      if (sourceDirectStock) {
        await tx.otherStock.update({
          where: { id: sourceDirectStock.id },
          data: { count: sourceDirectStock.count + quantity }
        });
      } else {
        // Create new direct stock record at source site with restored count
        await tx.otherStock.create({
          data: {
            category,
            count: quantity,
            siteId: fromSiteId,
            farmId: farm.id
          }
        });
      }

      // Delete destination stock record
      await tx.otherStock.delete({
        where: { id }
      });

      // Delete transfer log
      await tx.otherStockTransfer.delete({
        where: { id: existing.transfer.id }
      });

      return {
        success: true,
        message: `Transferred ${category} stock deleted. ${quantity} ${category} returned to original source site.`
      };
    });
  }

  // Standard direct stock deletion
  await prisma.otherStock.delete({
    where: {
      id
    }
  });

  return {
    success: true,
    message: "Other stock deleted successfully."
  };
};

