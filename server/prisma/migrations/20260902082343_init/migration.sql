-- CreateEnum
CREATE TYPE "HarvestType" AS ENUM ('INTERMEDIATE', 'FINAL');

-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "seedQuantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Harvest" ADD COLUMN     "harvestNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "harvestType" "HarvestType" NOT NULL DEFAULT 'INTERMEDIATE',
ADD COLUMN     "harvestWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "production" DROP NOT NULL,
ALTER COLUMN "averageWeight" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Stocking" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PondLease" (
    "id" TEXT NOT NULL,
    "totalLeaseAmount" DOUBLE PRECISION NOT NULL,
    "leaseStartDate" TIMESTAMP(3) NOT NULL,
    "leaseEndDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "tankId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PondLease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetOtp_mobile_idx" ON "PasswordResetOtp"("mobile");

-- AddForeignKey
ALTER TABLE "Stocking" ADD CONSTRAINT "Stocking_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PondLease" ADD CONSTRAINT "PondLease_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
