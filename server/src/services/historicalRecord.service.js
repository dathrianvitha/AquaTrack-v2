import crypto from "crypto";
import XLSX from "xlsx";
import prisma from "../config/prisma.js";
import { getUserFarm } from "../utils/farm.helpers.js";

/**
 * Standardize text for robust comparison
 */
const normalizeText = (text) => {
    if (!text) return "";
    return String(text)
        .toLowerCase()
        .replace(/[-_.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

/**
 * Parse date from Excel serial or string format cleanly in UTC
 */
export const parseTransactionDate = (val) => {
    if (!val) return null;

    // Excel serial number (e.g. 46180)
    if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/"))) {
        const num = Math.floor(Number(val));
        if (num > 20000 && num < 70000) {
            try {
                const parsed = XLSX.SSF.parse_date_code(num);
                if (parsed && parsed.y && parsed.m && parsed.d) {
                    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 0, 0, 0));
                }
            } catch (err) {
                // fall through
            }
        }
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
        return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0));
    }

    const str = String(val).trim();
    if (!str) return null;

    // YYYY-MM-DD
    const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymd) {
        return new Date(Date.UTC(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 0, 0, 0));
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
        return new Date(Date.UTC(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), 0, 0, 0));
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0));
    }

    return null;
};

/**
 * Cleanly format notes string preserving original category, remarks, and payer
 */
export const buildHistoricalNotes = ({ category, remarks, paidBy }) => {
    const parts = [];
    const cleanCat = category ? String(category).trim() : "";
    const cleanRemarks = remarks ? String(remarks).trim() : "";
    const cleanPaidBy = paidBy ? String(paidBy).trim() : "";

    if (cleanCat) {
        parts.push(`Category: ${cleanCat}`);
    } else {
        parts.push("Category: General Expense");
    }

    if (cleanRemarks) {
        parts.push(`Remarks: ${cleanRemarks}`);
    }

    if (cleanPaidBy) {
        parts.push(`Paid By: ${cleanPaidBy}`);
    }

    return parts.join(" | ");
};

/**
 * Match an Area string to one of the user's sites.
 * If ambiguous or not found, returns null so user can map it.
 */
export const matchSiteByArea = (areaStr, userSites) => {
    if (!areaStr || !userSites || !userSites.length) return null;
    const cleanArea = normalizeText(areaStr);
    if (!cleanArea) return null;

    // 1. Exact match on siteName
    const exactNameMatches = userSites.filter(
        (s) =>
            normalizeText(s.siteName) === cleanArea ||
            normalizeText(s.siteName).replace(/\s/g, "") === cleanArea.replace(/\s/g, "")
    );
    if (exactNameMatches.length === 1) return exactNameMatches[0];

    // 2. Substring matching on siteName ONLY if exactly ONE site matches
    const partialNameMatches = userSites.filter((s) => {
        const normName = normalizeText(s.siteName);
        return normName.includes(cleanArea) || cleanArea.includes(normName);
    });
    if (partialNameMatches.length === 1) {
        return partialNameMatches[0];
    }

    // 3. Location match ONLY if exactly ONE site in the entire farm has that location
    const locationMatches = userSites.filter(
        (s) => normalizeText(s.location) === cleanArea
    );
    if (locationMatches.length === 1) {
        return locationMatches[0];
    }

    // Ambiguous (e.g. multiple Juvvalapalem sites) or not found
    return null;
};

/**
 * Extract and parse rows from Excel / CSV buffer
 */
export const parseHistoricalWorkbook = (buffer, fileName, userSites, areaMappings = {}) => {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("The uploaded file does not contain any worksheets.");
    }

    // Find the right sheet: preference for 'expenditure' or 'day wise'
    let targetSheetName = workbook.SheetNames.find((name) => {
        const lower = name.toLowerCase();
        return lower.includes("expenditure") || lower.includes("day wise");
    });

    if (!targetSheetName) {
        // Find sheet that contains "area" or "expenses" or "amt paid" in header
        for (const name of workbook.SheetNames) {
            const s = workbook.Sheets[name];
            if (!s || !s["!ref"]) continue;
            const r = XLSX.utils.decode_range(s["!ref"]);
            r.e.c = Math.min(r.e.c, 15);
            r.e.r = Math.min(r.e.r, 10);
            const testRows = XLSX.utils.sheet_to_json(s, { header: 1, range: r });
            const hasHeader = testRows.some((row) =>
                Array.isArray(row) &&
                row.some((cell) => {
                    const c = String(cell || "").toLowerCase().trim();
                    return c === "area" || c === "expenses" || c === "amt paid";
                })
            );
            if (hasHeader) {
                targetSheetName = name;
                break;
            }
        }
    }

    if (!targetSheetName) {
        targetSheetName = workbook.SheetNames[0];
    }

    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet || !sheet["!ref"]) {
        throw new Error("Selected worksheet is empty.");
    }

    // CLAMP sheet range to prevent SheetJS memory/hanging issue on 16k columns
    const sheetRange = XLSX.utils.decode_range(sheet["!ref"]);
    sheetRange.e.c = Math.min(sheetRange.e.c, 15);
    sheet["!ref"] = XLSX.utils.encode_range(sheetRange);

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!rawRows || rawRows.length === 0) {
        throw new Error("No data found in worksheet.");
    }

    // Locate header row within first 15 rows
    let headerRowIdx = -1;
    let colIndices = {
        date: -1,
        area: -1,
        expenses: -1,
        credit: -1,
        amtPaid: -1,
        paidBy: -1,
        remarks: -1
    };

    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;

        let dateIdx = -1;
        let areaIdx = -1;
        let expensesIdx = -1;
        let creditIdx = -1;
        let amtPaidIdx = -1;
        let paidByIdx = -1;
        let remarksIdx = -1;

        row.forEach((cell, idx) => {
            const text = String(cell || "").trim().toLowerCase();
            if (text === "date") dateIdx = idx;
            else if (text === "area") areaIdx = idx;
            else if (text === "expenses" || text === "expense" || text === "category") expensesIdx = idx;
            else if (text === "credit") creditIdx = idx;
            else if (text === "amt paid" || text === "amount paid" || text === "amount" || text === "paid") amtPaidIdx = idx;
            else if (text === "paid by" || text === "payer" || text === "mode") paidByIdx = idx;
            else if (text === "remarks" || text === "remark" || text === "description" || text === "notes") remarksIdx = idx;
        });

        if (dateIdx !== -1 && (areaIdx !== -1 || expensesIdx !== -1 || amtPaidIdx !== -1)) {
            headerRowIdx = i;
            colIndices = {
                date: dateIdx,
                area: areaIdx,
                expenses: expensesIdx,
                credit: creditIdx,
                amtPaid: amtPaidIdx,
                paidBy: paidByIdx,
                remarks: remarksIdx
            };
            break;
        }
    }

    if (headerRowIdx === -1 || colIndices.amtPaid === -1) {
        throw new Error(
            "Could not identify required transaction columns (Date and Amt Paid) in the file. Please verify file format."
        );
    }

    // Normalize areaMappings lookup
    const normalizedMappings = {};
    for (const [k, v] of Object.entries(areaMappings)) {
        normalizedMappings[k] = v;
        normalizedMappings[k.toLowerCase().trim()] = v;
        normalizedMappings[normalizeText(k)] = v;
    }

    const validRecords = [];
    const skippedRows = [];
    const unmappedAreaMap = new Map(); // normalizedKey -> { displayName, count }
    const mappedSitesCountMap = new Map(); // siteId -> count

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];

        // Check if row is empty
        if (
            !Array.isArray(row) ||
            row.length === 0 ||
            row.every((c) => c === null || c === undefined || String(c).trim() === "")
        ) {
            skippedRows.push({
                rowNumber: r + 1,
                reason: "Empty row (no transaction data)",
                category: "-",
                area: "-",
                amtPaid: 0,
                credit: 0,
                rawDate: "-",
                remarks: "-"
            });
            continue;
        }

        const rawDate = row[colIndices.date];
        const rawArea = colIndices.area !== -1 ? String(row[colIndices.area] || "").trim() : "";
        const rawExpenses = colIndices.expenses !== -1 ? String(row[colIndices.expenses] || "").trim() : "";
        const rawCredit = colIndices.credit !== -1 ? Number(row[colIndices.credit]) : 0;
        const rawAmtPaid = Number(row[colIndices.amtPaid]);
        const rawPaidBy = colIndices.paidBy !== -1 ? String(row[colIndices.paidBy] || "").trim() : "";
        const rawRemarks = colIndices.remarks !== -1 ? String(row[colIndices.remarks] || "").trim() : "";

        // Check if row has an expense amount
        if (isNaN(rawAmtPaid) || rawAmtPaid <= 0) {
            if (!isNaN(rawCredit) && rawCredit > 0) {
                skippedRows.push({
                    rowNumber: r + 1,
                    reason: `Income/Credit entry (₹${rawCredit}) — historical module only imports expenses`,
                    category: rawExpenses || "-",
                    area: rawArea || "-",
                    amtPaid: 0,
                    credit: rawCredit,
                    rawDate: String(rawDate || "-"),
                    remarks: rawRemarks || "-"
                });
            } else {
                skippedRows.push({
                    rowNumber: r + 1,
                    reason: "Missing or zero expense amount (lookup item or non-transaction row)",
                    category: rawExpenses || "-",
                    area: rawArea || "-",
                    amtPaid: isNaN(rawAmtPaid) ? 0 : rawAmtPaid,
                    credit: isNaN(rawCredit) ? 0 : rawCredit,
                    rawDate: String(rawDate || "-"),
                    remarks: rawRemarks || "-"
                });
            }
            continue;
        }

        // Validate date
        const parsedDate = parseTransactionDate(rawDate);
        if (!parsedDate) {
            skippedRows.push({
                rowNumber: r + 1,
                reason: `Invalid transaction date: "${rawDate || ""}"`,
                category: rawExpenses || "-",
                area: rawArea || "-",
                amtPaid: rawAmtPaid,
                credit: isNaN(rawCredit) ? 0 : rawCredit,
                rawDate: String(rawDate || "-"),
                remarks: rawRemarks || "-"
            });
            continue;
        }

        // Determine site assignment
        let resolvedSiteId = null;
        let resolvedSiteName = "";

        const mappingVal =
            normalizedMappings[rawArea] ||
            normalizedMappings[rawArea.toLowerCase().trim()] ||
            normalizedMappings[normalizeText(rawArea)];

        // 1. Check explicit user mapping provided during preview/confirm
        if (mappingVal) {
            if (mappingVal === "skip") {
                skippedRows.push({
                    rowNumber: r + 1,
                    reason: `Skipped by user mapping for area "${rawArea}"`,
                    category: rawExpenses || "-",
                    area: rawArea || "-",
                    amtPaid: rawAmtPaid,
                    credit: isNaN(rawCredit) ? 0 : rawCredit,
                    rawDate: String(rawDate || "-"),
                    remarks: rawRemarks || "-"
                });
                continue;
            }
            const mappedSite = userSites.find((s) => s.id === mappingVal);
            if (mappedSite) {
                resolvedSiteId = mappedSite.id;
                resolvedSiteName = mappedSite.siteName;
            }
        }

        // 2. Auto-match if not explicitly mapped
        if (!resolvedSiteId && rawArea) {
            const autoSite = matchSiteByArea(rawArea, userSites);
            if (autoSite) {
                resolvedSiteId = autoSite.id;
                resolvedSiteName = autoSite.siteName;
            }
        }

        // If still unmapped
        if (!resolvedSiteId) {
            const displayName = rawArea || "(Unspecified Area)";
            const normKey = normalizeText(displayName) || "(unspecified)";
            const existing = unmappedAreaMap.get(normKey);
            if (existing) {
                existing.count += 1;
            } else {
                unmappedAreaMap.set(normKey, { displayName, count: 1 });
            }
        } else {
            mappedSitesCountMap.set(resolvedSiteId, (mappedSitesCountMap.get(resolvedSiteId) || 0) + 1);
        }

        const notes = buildHistoricalNotes({
            category: rawExpenses,
            remarks: rawRemarks,
            paidBy: rawPaidBy
        });

        validRecords.push({
            rowNumber: r + 1,
            date: parsedDate,
            amount: Math.round(rawAmtPaid * 100) / 100,
            notes,
            rawArea,
            siteId: resolvedSiteId,
            siteName: resolvedSiteName,
            originalCategory: rawExpenses,
            originalRemarks: rawRemarks,
            originalPaidBy: rawPaidBy
        });
    }

    const unmappedAreas = Array.from(unmappedAreaMap.values()).map((item) => ({
        areaName: item.displayName,
        count: item.count
    }));

    const mappedSites = Array.from(mappedSitesCountMap.entries()).map(([siteId, count]) => {
        const s = userSites.find((site) => site.id === siteId);
        return {
            siteId,
            siteName: s ? s.siteName : siteId,
            count
        };
    });

    return {
        targetSheetName,
        totalRowsInSheet: rawRows.length,
        validRecords,
        skippedRows,
        unmappedAreas,
        mappedSites
    };
};

/**
 * Preview uploaded historical records file before import
 */
export const previewHistoricalFile = async (userId, fileBuffer, fileName) => {
    const farm = await getUserFarm(userId);

    const userSites = await prisma.site.findMany({
        where: { farmId: farm.id },
        select: { id: true, siteName: true, location: true },
        orderBy: { siteName: "asc" }
    });

    // Compute SHA-256 hash for duplicate file detection
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Check if this file was already imported
    const existingBatch = await prisma.historicalImportBatch.findFirst({
        where: {
            farmId: farm.id,
            fileHash
        },
        orderBy: { createdAt: "desc" }
    });

    const parsed = parseHistoricalWorkbook(fileBuffer, fileName, userSites, {});

    const totalValidAmount = parsed.validRecords.reduce((sum, r) => sum + r.amount, 0);

    return {
        fileHash,
        fileName,
        sheetName: parsed.targetSheetName,
        totalRows: parsed.totalRowsInSheet,
        validRecordCount: parsed.validRecords.length,
        skippedRowCount: parsed.skippedRows.length,
        totalAmount: Math.round(totalValidAmount * 100) / 100,
        isDuplicate: Boolean(existingBatch),
        previousImport: existingBatch
            ? {
                  id: existingBatch.id,
                  fileName: existingBatch.fileName,
                  recordCount: existingBatch.recordCount,
                  totalAmount: existingBatch.totalAmount,
                  createdAt: existingBatch.createdAt
              }
            : null,
        unmappedAreas: parsed.unmappedAreas,
        mappedSites: parsed.mappedSites,
        sampleRecords: parsed.validRecords.slice(0, 15).map((r) => ({
            rowNumber: r.rowNumber,
            date: r.date.toISOString().split("T")[0],
            amount: r.amount,
            notes: r.notes,
            rawArea: r.rawArea,
            siteName: r.siteName || "Unmapped",
            isMapped: Boolean(r.siteId)
        })),
        skippedRows: parsed.skippedRows,
        availableSites: userSites
    };
};

/**
 * Perform actual import of validated historical records into database
 */
export const importHistoricalRecords = async (userId, { fileBuffer, fileName, areaMappings = {}, userNotes = "" }) => {
    const farm = await getUserFarm(userId);

    const userSites = await prisma.site.findMany({
        where: { farmId: farm.id },
        select: { id: true, siteName: true, location: true }
    });

    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const parsed = parseHistoricalWorkbook(fileBuffer, fileName, userSites, areaMappings);

    // Filter to records that have a resolved siteId belonging to this farm
    const siteIdSet = new Set(userSites.map((s) => s.id));
    const importableRecords = [];
    const unmappedSkipped = [];

    for (const record of parsed.validRecords) {
        if (record.siteId && siteIdSet.has(record.siteId)) {
            importableRecords.push(record);
        } else {
            unmappedSkipped.push({
                rowNumber: record.rowNumber,
                reason: `Skipped: Area "${record.rawArea}" was not mapped to an active site`,
                category: record.originalCategory || "-",
                area: record.rawArea || "-",
                amtPaid: record.amount || 0,
                credit: 0,
                rawDate: record.date ? record.date.toISOString().split("T")[0] : "-",
                remarks: record.originalRemarks || "-"
            });
        }
    }

    if (importableRecords.length === 0) {
        throw new Error(
            "No valid records could be imported. Please map unmapped areas to valid sites or verify file contents."
        );
    }

    const totalAmount = importableRecords.reduce((sum, r) => sum + r.amount, 0);
    const allSkipped = [...parsed.skippedRows, ...unmappedSkipped];

    // Save batch and records inside a database transaction
    const result = await prisma.$transaction(
        async (tx) => {
            const batch = await tx.historicalImportBatch.create({
                data: {
                    farmId: farm.id,
                    fileName,
                    fileHash,
                    recordCount: importableRecords.length,
                    totalAmount: Math.round(totalAmount * 100) / 100
                }
            });

            // Insert historical records in batches of 500 for high performance
            const BATCH_SIZE = 500;
            for (let i = 0; i < importableRecords.length; i += BATCH_SIZE) {
                const chunk = importableRecords.slice(i, i + BATCH_SIZE).map((r) => ({
                    farmId: farm.id,
                    siteId: r.siteId,
                    importBatchId: batch.id,
                    date: r.date,
                    amount: r.amount,
                    notes: r.notes,
                    sourceArea: r.rawArea,
                    sourceCategory: r.originalCategory
                }));

                await tx.historicalExpense.createMany({
                    data: chunk
                });
            }

            return batch;
        },
        {
            timeout: 60000 // 60s timeout for large imports
        }
    );

    return {
        batchId: result.id,
        fileName: result.fileName,
        importedCount: importableRecords.length,
        skippedCount: allSkipped.length,
        skippedRows: allSkipped,
        totalAmount: result.totalAmount,
        createdAt: result.createdAt
    };
};

/**
 * Fetch historical expenses with filters, search, and pagination.
 * Computes both filtered record counts & sums and all-time total counts & sums.
 */
export const getHistoricalRecords = async (userId, query = {}) => {
    const farm = await getUserFarm(userId);

    const { siteId, date, startDate, endDate, search, page = 1, limit = 25 } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Build Prisma where clause for filtered subset
    const where = {
        farmId: farm.id
    };

    if (siteId && siteId !== "ALL") {
        where.siteId = siteId;
    }

    // Specific date filter
    if (date) {
        const parsedDate = parseTransactionDate(date);
        if (parsedDate) {
            const nextDay = new Date(parsedDate);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            where.date = {
                gte: parsedDate,
                lt: nextDay
            };
        }
    } else if (startDate || endDate) {
        where.date = {};
        if (startDate) {
            const parsedStart = parseTransactionDate(startDate);
            if (parsedStart) {
                where.date.gte = parsedStart;
            }
        }
        if (endDate) {
            const parsedEnd = parseTransactionDate(endDate);
            if (parsedEnd) {
                const endNextDay = new Date(parsedEnd);
                endNextDay.setUTCDate(endNextDay.getUTCDate() + 1);
                where.date.lt = endNextDay;
            }
        }
    }

    // Search filter across notes
    if (search && String(search).trim()) {
        const cleanSearch = String(search).trim();
        where.notes = {
            contains: cleanSearch,
            mode: "insensitive"
        };
    }

    // Query records, filtered total count, filtered amount, and all-time totals in parallel
    const [records, totalRecords, aggregate, allTimeTotalRecords, allTimeAggregate] = await Promise.all([
        prisma.historicalExpense.findMany({
            where,
            include: {
                site: {
                    select: {
                        id: true,
                        siteName: true,
                        location: true
                    }
                },
                importBatch: {
                    select: {
                        id: true,
                        fileName: true,
                        createdAt: true
                    }
                }
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            skip,
            take: limitNum
        }),
        prisma.historicalExpense.count({ where }),
        prisma.historicalExpense.aggregate({
            where,
            _sum: {
                amount: true
            }
        }),
        prisma.historicalExpense.count({ where: { farmId: farm.id } }),
        prisma.historicalExpense.aggregate({
            where: { farmId: farm.id },
            _sum: {
                amount: true
            }
        })
    ]);

    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    return {
        records,
        pagination: {
            totalRecords,
            totalPages,
            currentPage: pageNum,
            limit: limitNum,
            totalAmount: Math.round((aggregate._sum.amount || 0) * 100) / 100,
            allTimeTotalRecords,
            allTimeTotalAmount: Math.round((allTimeAggregate._sum.amount || 0) * 100) / 100
        }
    };
};

/**
 * Delete a single historical record permanently and update batch statistics
 */
export const deleteHistoricalRecord = async (userId, recordId) => {
    const farm = await getUserFarm(userId);

    const record = await prisma.historicalExpense.findFirst({
        where: {
            id: recordId,
            farmId: farm.id
        }
    });

    if (!record) {
        throw new Error("Historical record not found or access denied.");
    }

    await prisma.$transaction(async (tx) => {
        // If linked to an import batch, decrement the batch totals
        if (record.importBatchId) {
            const batch = await tx.historicalImportBatch.findUnique({
                where: { id: record.importBatchId }
            });
            if (batch) {
                const newCount = Math.max(0, batch.recordCount - 1);
                const newTotal = Math.max(0, Math.round((batch.totalAmount - record.amount) * 100) / 100);
                await tx.historicalImportBatch.update({
                    where: { id: record.importBatchId },
                    data: {
                        recordCount: newCount,
                        totalAmount: newTotal
                    }
                });
            }
        }

        await tx.historicalExpense.delete({
            where: { id: recordId }
        });
    });

    return {
        success: true,
        message: "Historical record deleted successfully."
    };
};

/**
 * Fetch all historical import batches for the user's farm
 */
export const getHistoricalBatches = async (userId) => {
    const farm = await getUserFarm(userId);

    const batches = await prisma.historicalImportBatch.findMany({
        where: { farmId: farm.id },
        include: {
            expenses: {
                select: {
                    site: {
                        select: {
                            id: true,
                            siteName: true
                        }
                    }
                },
                distinct: ["siteId"]
            },
            _count: {
                select: {
                    expenses: true
                }
            }
        },
        orderBy: { importedAt: "desc" }
    });

    return batches.map((b) => {
        const uniqueSites = b.expenses.map((e) => e.site?.siteName).filter(Boolean);
        return {
            id: b.id,
            fileName: b.fileName,
            fileHash: b.fileHash,
            initialRecordCount: b.recordCount,
            currentRecordCount: b._count.expenses,
            totalAmount: b.totalAmount,
            importedAt: b.importedAt,
            createdAt: b.createdAt,
            sitesCovered: uniqueSites
        };
    });
};

/**
 * Delete a historical import batch and all its records in an atomic transaction
 */
export const deleteHistoricalBatch = async (userId, batchId) => {
    const farm = await getUserFarm(userId);

    const batch = await prisma.historicalImportBatch.findFirst({
        where: {
            id: batchId,
            farmId: farm.id
        }
    });

    if (!batch) {
        throw new Error("Historical import batch not found or access denied.");
    }

    const count = await prisma.historicalExpense.count({
        where: {
            importBatchId: batchId,
            farmId: farm.id
        }
    });

    await prisma.$transaction([
        prisma.historicalExpense.deleteMany({
            where: {
                importBatchId: batchId,
                farmId: farm.id
            }
        }),
        prisma.historicalImportBatch.delete({
            where: { id: batchId }
        })
    ]);

    return {
        success: true,
        message: `Deleted import batch "${batch.fileName}" and its ${count} historical records.`,
        deletedCount: count
    };
};
