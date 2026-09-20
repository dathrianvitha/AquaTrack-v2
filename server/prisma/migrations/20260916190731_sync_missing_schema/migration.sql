-- CreateTable
CREATE TABLE "OtherStock" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "notes" TEXT,
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtherStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Netting" (
    "id" TEXT NOT NULL,
    "shrimpCount" INTEGER NOT NULL,
    "weightGrams" DOUBLE PRECISION NOT NULL,
    "nettingNumber" INTEGER NOT NULL,
    "nettingDate" TIMESTAMP(3) NOT NULL,
    "cropId" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Netting_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OtherStock" ADD CONSTRAINT "OtherStock_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Netting" ADD CONSTRAINT "Netting_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Netting" ADD CONSTRAINT "Netting_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Netting" ADD CONSTRAINT "Netting_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
