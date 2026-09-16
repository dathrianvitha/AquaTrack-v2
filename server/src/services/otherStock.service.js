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
      farmId: farm.id
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

  return prisma.otherStock.update({
    where: {
      id
    },
    data: updateData
  });
};

/*
 * Delete an Other Stock record
 */
export const deleteOtherStockService = async (userId, id) => {
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

  return prisma.otherStock.delete({
    where: {
      id
    }
  });
};
