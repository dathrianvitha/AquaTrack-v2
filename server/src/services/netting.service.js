import prisma from "../config/prisma.js";

/**
 * Create Netting Record
 */
export const createNetting = async (userId, data) => {
  const farm = await prisma.farm.findFirst({
    where: { userId }
  });

  if (!farm) {
    throw new Error("Please create a farm first.");
  }

  // Verify Site belongs to user's Farm
  const site = await prisma.site.findFirst({
    where: {
      id: data.siteId,
      farmId: farm.id
    }
  });

  if (!site) {
    throw new Error("Site not found.");
  }

  // Verify Tank belongs to selected Site
  const tank = await prisma.tank.findFirst({
    where: {
      id: data.tankId,
      siteId: site.id
    }
  });

  if (!tank) {
    throw new Error("Tank not found for the selected site.");
  }

  // Determine ACTIVE crop for selected Tank
  const activeCrop = await prisma.crop.findFirst({
    where: {
      tankId: data.tankId,
      status: "ACTIVE"
    }
  });

  if (!activeCrop) {
    throw new Error("No active crop found for this tank.");
  }

  // Automatically calculate sequence number for this active crop
  const existingCount = await prisma.netting.count({
    where: { cropId: activeCrop.id }
  });
  const nettingNumber = existingCount + 1;

  // Calculate weight in grams (shrimpCount / 1000)
  const weightGrams = data.shrimpCount / 1000;

  const netting = await prisma.netting.create({
    data: {
      shrimpCount: Number(data.shrimpCount),
      weightGrams,
      nettingNumber,
      nettingDate: new Date(data.nettingDate),
      cropId: activeCrop.id,
      tankId: data.tankId,
      siteId: data.siteId
    },
    include: {
      site: true,
      tank: true,
      crop: true
    }
  });

  return netting;
};

/**
 * Get Netting Records
 */
export const getNettings = async (userId, filters = {}) => {
  const farm = await prisma.farm.findFirst({
    where: { userId }
  });

  if (!farm) {
    throw new Error("Please create a farm first.");
  }

  const where = {
    site: {
      farmId: farm.id
    }
  };

  if (filters.siteId && filters.siteId !== 'ALL') {
    where.siteId = filters.siteId;
  }

  if (filters.tankId && filters.tankId !== 'ALL') {
    where.tankId = filters.tankId;
  }

  if (!prisma.netting || typeof prisma.netting.findMany !== 'function') {
    return [];
  }

  const nettings = await prisma.netting.findMany({
    where,
    include: {
      site: true,
      tank: true,
      crop: true
    },
    orderBy: [
      { nettingDate: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  return nettings;
};

/**
 * Update Netting Record
 */
export const updateNetting = async (userId, nettingId, data) => {
  const farm = await prisma.farm.findFirst({
    where: { userId }
  });

  if (!farm) {
    throw new Error("Please create a farm first.");
  }

  const existingNetting = await prisma.netting.findFirst({
    where: {
      id: nettingId,
      site: {
        farmId: farm.id
      }
    }
  });

  if (!existingNetting) {
    throw new Error("Netting record not found.");
  }

  const updateData = {};

  if (data.shrimpCount !== undefined && data.shrimpCount !== null) {
    updateData.shrimpCount = Number(data.shrimpCount);
    updateData.weightGrams = Number(data.shrimpCount) / 1000;
  }

  if (data.nettingDate) {
    updateData.nettingDate = new Date(data.nettingDate);
  }

  const updated = await prisma.netting.update({
    where: { id: nettingId },
    data: updateData,
    include: {
      site: true,
      tank: true,
      crop: true
    }
  });

  return updated;
};

/**
 * Delete Netting Record
 */
export const deleteNetting = async (userId, nettingId) => {
  const farm = await prisma.farm.findFirst({
    where: { userId }
  });

  if (!farm) {
    throw new Error("Please create a farm first.");
  }

  const existingNetting = await prisma.netting.findFirst({
    where: {
      id: nettingId,
      site: {
        farmId: farm.id
      }
    }
  });

  if (!existingNetting) {
    throw new Error("Netting record not found.");
  }

  await prisma.netting.delete({
    where: { id: nettingId }
  });

  return { message: "Netting record deleted successfully" };
};
