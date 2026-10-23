-- CreateTable
CREATE TABLE "HistoricalImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT,
    "recordCount" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalExpense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "sourceArea" TEXT,
    "sourceCategory" TEXT,
    "siteId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalImportBatch_farmId_idx" ON "HistoricalImportBatch"("farmId");

-- CreateIndex
CREATE INDEX "HistoricalImportBatch_fileHash_idx" ON "HistoricalImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "HistoricalExpense_farmId_idx" ON "HistoricalExpense"("farmId");

-- CreateIndex
CREATE INDEX "HistoricalExpense_siteId_idx" ON "HistoricalExpense"("siteId");

-- CreateIndex
CREATE INDEX "HistoricalExpense_date_idx" ON "HistoricalExpense"("date");

-- CreateIndex
CREATE INDEX "HistoricalExpense_importBatchId_idx" ON "HistoricalExpense"("importBatchId");

-- AddForeignKey
ALTER TABLE "HistoricalImportBatch" ADD CONSTRAINT "HistoricalImportBatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalExpense" ADD CONSTRAINT "HistoricalExpense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalExpense" ADD CONSTRAINT "HistoricalExpense_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalExpense" ADD CONSTRAINT "HistoricalExpense_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "HistoricalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
