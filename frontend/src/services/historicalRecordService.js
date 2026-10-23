import api from "./api";

/**
 * Historical Records Service
 * Manages previewing, mapping, importing, querying, and safe deletion of historical expenses.
 */

export const previewHistoricalFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/historical-records/preview", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        timeout: 60000 // 60s for reading large files
    });

    return response.data;
};

export const importHistoricalRecords = async (file, areaMappings = {}, notes = "") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("areaMappings", JSON.stringify(areaMappings));
    if (notes) {
        formData.append("notes", notes);
    }

    const response = await api.post("/historical-records/import", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        timeout: 120000 // 120s for bulk DB insertion
    });

    return response.data;
};

export const getHistoricalRecords = async (params = {}) => {
    const response = await api.get("/historical-records", {
        params
    });

    return response.data;
};

export const getHistoricalBatches = async () => {
    const response = await api.get("/historical-records/batches");
    return response.data;
};

export const deleteHistoricalRecord = async (recordId) => {
    const response = await api.delete(`/historical-records/${recordId}`);
    return response.data;
};

export const deleteHistoricalBatch = async (batchId) => {
    const response = await api.delete(`/historical-records/batches/${batchId}`);
    return response.data;
};

export const historicalRecordService = {
    previewHistoricalFile,
    importHistoricalRecords,
    getHistoricalRecords,
    getHistoricalBatches,
    deleteHistoricalRecord,
    deleteHistoricalBatch
};

export default historicalRecordService;
