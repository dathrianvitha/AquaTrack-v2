import { Router } from "express";
import multer from "multer";
import auth from "../middleware/auth.middleware.js";
import {
    previewHistoricalFileController,
    importHistoricalRecordsController,
    getHistoricalRecordsController,
    getHistoricalBatchesController,
    deleteHistoricalRecordController,
    deleteHistoricalBatchController
} from "../controllers/historicalRecord.controller.js";

const router = Router();

// Configure memory storage for uploaded spreadsheets
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 30 * 1024 * 1024 // 30MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = [".xlsx", ".xls", ".csv"];
        const originalName = (file.originalname || "").toLowerCase();
        const isValidExt = allowedExtensions.some((ext) => originalName.endsWith(ext));

        if (isValidExt) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed."));
        }
    }
});

// All historical record routes require authentication
router.use(auth);

// GET /api/historical-records - Query historical expenses
router.get("/", getHistoricalRecordsController);

// GET /api/historical-records/batches - List all import batches
router.get("/batches", getHistoricalBatchesController);

// POST /api/historical-records/preview - Preview and validate file without saving
router.post("/preview", upload.single("file"), previewHistoricalFileController);

// POST /api/historical-records/import - Confirm import and save records
router.post("/import", upload.single("file"), importHistoricalRecordsController);

// DELETE /api/historical-records/batches/:batchId - Delete a batch and all its records
router.delete("/batches/:batchId", deleteHistoricalBatchController);

// DELETE /api/historical-records/:id - Delete an individual historical record
router.delete("/:id", deleteHistoricalRecordController);

export default router;
