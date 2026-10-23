import {
    previewHistoricalFile,
    importHistoricalRecords,
    getHistoricalRecords,
    getHistoricalBatches,
    deleteHistoricalRecord,
    deleteHistoricalBatch
} from "../services/historicalRecord.service.js";

/**
 * Upload file and generate pre-import preview & mapping analysis
 */
export const previewHistoricalFileController = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded. Please upload a valid .xlsx or .csv file."
            });
        }

        const preview = await previewHistoricalFile(
            req.user.id,
            req.file.buffer,
            req.file.originalname
        );

        return res.status(200).json({
            success: true,
            message: "File analyzed successfully",
            data: preview
        });
    } catch (error) {
        console.error("Historical file preview error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to preview file"
        });
    }
};

/**
 * Confirm and save historical expenses into database
 */
export const importHistoricalRecordsController = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file provided for import."
            });
        }

        let areaMappings = {};
        if (req.body.areaMappings) {
            try {
                areaMappings = typeof req.body.areaMappings === "string"
                    ? JSON.parse(req.body.areaMappings)
                    : req.body.areaMappings;
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid areaMappings format. Must be valid JSON."
                });
            }
        }

        const result = await importHistoricalRecords(req.user.id, {
            fileBuffer: req.file.buffer,
            fileName: req.file.originalname,
            areaMappings,
            userNotes: req.body.notes
        });

        return res.status(201).json({
            success: true,
            message: `Successfully imported ${result.importedCount} historical records`,
            data: result
        });
    } catch (error) {
        console.error("Historical records import error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to import historical records"
        });
    }
};

/**
 * Query historical expenses with filters, search, and pagination
 */
export const getHistoricalRecordsController = async (req, res) => {
    try {
        const result = await getHistoricalRecords(req.user.id, req.query);

        return res.status(200).json({
            success: true,
            message: "Historical records retrieved successfully",
            data: result.records,
            pagination: result.pagination
        });
    } catch (error) {
        console.error("Get historical records error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to retrieve historical records"
        });
    }
};

/**
 * Fetch list of all historical import batches for the user's farm
 */
export const getHistoricalBatchesController = async (req, res) => {
    try {
        const batches = await getHistoricalBatches(req.user.id);

        return res.status(200).json({
            success: true,
            message: "Historical batches retrieved successfully",
            data: batches
        });
    } catch (error) {
        console.error("Get historical batches error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to retrieve historical batches"
        });
    }
};

/**
 * Delete a single historical record permanently
 */
export const deleteHistoricalRecordController = async (req, res) => {
    try {
        const result = await deleteHistoricalRecord(req.user.id, req.params.id);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error("Delete historical record error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to delete historical record"
        });
    }
};

/**
 * Delete an import batch and all associated historical records
 */
export const deleteHistoricalBatchController = async (req, res) => {
    try {
        const result = await deleteHistoricalBatch(req.user.id, req.params.batchId);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        console.error("Delete historical batch error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to delete historical batch"
        });
    }
};
