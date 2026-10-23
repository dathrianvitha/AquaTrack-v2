-- AlterTable
ALTER TABLE "Stocking" ADD COLUMN IF NOT EXISTS "medicineType" TEXT;
ALTER TABLE "Stocking" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "medicineType" TEXT;

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN IF NOT EXISTS "medicineType" TEXT;
