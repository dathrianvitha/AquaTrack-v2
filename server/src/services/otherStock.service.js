import prisma from "../config/prisma.js";
import { getUserFarm } from "../utils/farm.helpers.js";

/*
 * Get all Other Stock records for logged-in user's farm
 */
/*
 * Get all Other Stock records for logged-in user's farm
 */
export const getOtherStocksService = async (userId) => {
  const farm = await getUserFarm(userId);

  // Auto-consolidate any duplicate records for the same (siteId, category) at the farm
  const allStocks = await prisma.otherStock.findMany({
    where: { farmId: farm.id },
    orderBy: { createdAt: "asc" }
  });

  const groups = {};
  for (const item of allStocks) {
    const key = `${item.siteId || 'no_site'}_${item.category.trim().toLowerCase()}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  for (const key of Object.keys(groups)) {
    const list = groups[key];
    if (list.length > 1) {
      const primary = list[0];
      const duplicates = list.slice(1);
      let extraCount = 0;
      let extraUnderRepair = 0;

      for (const dup of duplicates) {
        extraCount += dup.count;
        extraUnderRepair += (dup.underRepair || 0);

        // Re-link repair logs if present
        try {
          await prisma.otherStockRepairLog.updateMany({
            where: { otherStockId: dup.id },
            data: { otherStockId: primary.id }
          });
        } catch (e) {
          // ignore if table not present
        }

        // Delete duplicate record
        await prisma.otherStock.delete({
          where: { id: dup.id }
        });
      }

      // Update primary count and underRepair
      await prisma.otherStock.update({
        where: { id: primary.id },
        data: {
          count: primary.count + extraCount,
          underRepair: (primary.underRepair || 0) + extraUnderRepair
        }
      });
    }
  }

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
      repairLogs: {
        orderBy: {
          createdAt: "desc"
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
  const targetSiteId = data.siteId || null;
  const countVal = parseInt(data.count, 10);

  // Merge into existing stock record for same category at this site if present
  const existing = await prisma.otherStock.findFirst({
    where: {
      farmId: farm.id,
      siteId: targetSiteId,
      category: data.category
    },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return prisma.otherStock.update({
      where: { id: existing.id },
      data: {
        count: existing.count + countVal,
        ...(data.notes ? { notes: data.notes } : {})
      },
      include: {
        site: {
          select: { id: true, siteName: true, location: true }
        },
        repairLogs: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  }

  return prisma.otherStock.create({
    data: {
      category: data.category,
      count: countVal,
      notes: data.notes || null,
      siteId: targetSiteId,
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

      if (newCount === 0 && (!stockRecord.underRepair || stockRecord.underRepair === 0) && !stockRecord.transferId) {
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

    // Check if an existing stock record for this category already exists at destination site
    const destStock = await tx.otherStock.findFirst({
      where: {
        siteId: toSiteId,
        category,
        farmId: farm.id
      },
      orderBy: [
        { transferId: "asc" },
        { createdAt: "asc" }
      ]
    });

    let destinationStock;
    if (destStock) {
      // Merge count into existing stock record at destination site
      destinationStock = await tx.otherStock.update({
        where: { id: destStock.id },
        data: {
          count: destStock.count + transferCount
        },
        include: {
          site: { select: { id: true, siteName: true, location: true } },
          repairLogs: { orderBy: { createdAt: "desc" } },
          transfer: {
            include: {
              fromSite: { select: { id: true, siteName: true } },
              toSite: { select: { id: true, siteName: true } }
            }
          }
        }
      });
    } else {
      // Create new stock record at destination site
      destinationStock = await tx.otherStock.create({
        data: {
          category,
          count: transferCount,
          siteId: toSiteId,
          farmId: farm.id,
          transferId: transferLog.id
        },
        include: {
          site: { select: { id: true, siteName: true, location: true } },
          repairLogs: { orderBy: { createdAt: "desc" } },
          transfer: {
            include: {
              fromSite: { select: { id: true, siteName: true } },
              toSite: { select: { id: true, siteName: true } }
            }
          }
        }
      });
    }

    return {
      message: `Successfully transferred ${transferCount} ${category} from ${fromSite.siteName} to ${toSite.siteName}.`,
      transfer: transferLog,
      destinationStock
    };
  });
};

/*
 * Move Other Stock to repair
 */
export const sendToRepairService = async (userId, id, quantity, notes) => {
  const farm = await getUserFarm(userId);

  const repairQty = parseInt(quantity, 10);
  if (isNaN(repairQty) || repairQty <= 0) {
    throw new Error("Quantity to send for repair must be a positive whole number.");
  }

  const existing = await prisma.otherStock.findFirst({
    where: {
      id,
      farmId: farm.id
    }
  });

  if (!existing) {
    throw new Error("Other Stock record not found or access denied.");
  }

  if (existing.count < repairQty) {
    throw new Error(
      `Cannot send ${repairQty} ${existing.category} for repair. Only ${existing.count} available.`
    );
  }

  const cleanNotes = notes ? String(notes).trim() : null;

  return prisma.$transaction(async (tx) => {
    // Create repair log entry
    await tx.otherStockRepairLog.create({
      data: {
        actionType: "REPAIR",
        quantity: repairQty,
        notes: cleanNotes,
        otherStockId: id
      }
    });

    const updated = await tx.otherStock.update({
      where: { id },
      data: {
        count: existing.count - repairQty,
        underRepair: (existing.underRepair || 0) + repairQty,
        ...(cleanNotes ? { notes: cleanNotes } : {})
      },
      include: {
        site: { select: { id: true, siteName: true, location: true } },
        repairLogs: { orderBy: { createdAt: "desc" } },
        transfer: {
          include: {
            fromSite: { select: { id: true, siteName: true } },
            toSite: { select: { id: true, siteName: true } }
          }
        }
      }
    });

    return {
      success: true,
      message: `Sent ${repairQty} ${existing.category} for repair.`,
      data: updated
    };
  });
};

/*
 * Return Other Stock from repair
 */
export const returnFromRepairService = async (userId, id, quantity, notes) => {
  const farm = await getUserFarm(userId);

  const returnQty = parseInt(quantity, 10);
  if (isNaN(returnQty) || returnQty <= 0) {
    throw new Error("Quantity returned must be a positive whole number.");
  }

  const existing = await prisma.otherStock.findFirst({
    where: {
      id,
      farmId: farm.id
    }
  });

  if (!existing) {
    throw new Error("Other Stock record not found or access denied.");
  }

  const currentUnderRepair = existing.underRepair || 0;
  if (currentUnderRepair < returnQty) {
    throw new Error(
      `Cannot return ${returnQty} ${existing.category} from repair. Only ${currentUnderRepair} currently under repair.`
    );
  }

  const cleanNotes = notes ? String(notes).trim() : null;

  return prisma.$transaction(async (tx) => {
    // Create return repair log entry
    await tx.otherStockRepairLog.create({
      data: {
        actionType: "RETURN",
        quantity: returnQty,
        notes: cleanNotes,
        otherStockId: id
      }
    });

    const updated = await tx.otherStock.update({
      where: { id },
      data: {
        count: existing.count + returnQty,
        underRepair: currentUnderRepair - returnQty,
        ...(cleanNotes ? { notes: cleanNotes } : {})
      },
      include: {
        site: { select: { id: true, siteName: true, location: true } },
        repairLogs: { orderBy: { createdAt: "desc" } },
        transfer: {
          include: {
            fromSite: { select: { id: true, siteName: true } },
            toSite: { select: { id: true, siteName: true } }
          }
        }
      }
    });

    return {
      success: true,
      message: `Marked ${returnQty} ${existing.category} as returned from repair.`,
      data: updated
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

  if ((existing.underRepair || 0) > 0) {
    throw new Error(
      `Cannot delete stock record while ${existing.underRepair} ${existing.category} are currently under repair. Please return items from repair first.`
    );
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

/*
 * Delete an Other Stock Repair Log entry
 */
export const deleteOtherStockRepairLogService = async (userId, logId) => {
  const farm = await getUserFarm(userId);

  const repairLog = await prisma.otherStockRepairLog.findUnique({
    where: { id: logId },
    include: {
      otherStock: true
    }
  });

  if (!repairLog || repairLog.otherStock.farmId !== farm.id) {
    throw new Error("Repair log entry not found or access denied.");
  }

  const stock = repairLog.otherStock;
  const qty = repairLog.quantity;

  return prisma.$transaction(async (tx) => {
    let newCount = stock.count;
    let newUnderRepair = stock.underRepair || 0;

    if (repairLog.actionType === "REPAIR") {
      newUnderRepair = Math.max(0, newUnderRepair - qty);
      newCount = newCount + qty;
    } else if (repairLog.actionType === "RETURN") {
      newCount = Math.max(0, newCount - qty);
      newUnderRepair = newUnderRepair + qty;
    }

    await tx.otherStockRepairLog.delete({
      where: { id: logId }
    });

    const updatedStock = await tx.otherStock.update({
      where: { id: stock.id },
      data: {
        count: newCount,
        underRepair: newUnderRepair
      },
      include: {
        site: { select: { id: true, siteName: true, location: true } },
        repairLogs: { orderBy: { createdAt: "desc" } },
        transfer: {
          include: {
            fromSite: { select: { id: true, siteName: true } },
            toSite: { select: { id: true, siteName: true } }
          }
        }
      }
    });

    return {
      success: true,
      message: "Repair log entry deleted successfully.",
      data: updatedStock
    };
  });
};

/*
 * Get Other Stock Transfer Logs
 */
export const getOtherStockTransfersService = async (userId) => {
  const farm = await getUserFarm(userId);
  return prisma.otherStockTransfer.findMany({
    where: { farmId: farm.id },
    include: {
      fromSite: { select: { id: true, siteName: true } },
      toSite: { select: { id: true, siteName: true } }
    },
    orderBy: { createdAt: "desc" }
  });
};



