import api from './api';

/**
 * Other Stock Service (Farm-Level Equipment & Parts)
 * Communicates with backend /other-stock API routes.
 */

// Get all Other Stock items (GET /api/other-stock)
export const getOtherStocks = async () => {
  try {
    const response = await api.get(`/other-stock?_t=${Date.now()}`);
    return response.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch other stock records');
  }
};

// Create Other Stock item (POST /api/other-stock)
export const createOtherStock = async (data) => {
  try {
    const response = await api.post('/other-stock', data);
    return response.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to add other stock');
  }
};

// Update Other Stock item (PUT /api/other-stock/:id)
export const updateOtherStock = async (id, data) => {
  try {
    const response = await api.put(`/other-stock/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to update other stock');
  }
};

// Transfer Other Stock between sites (POST /api/other-stock/transfer)
export const transferOtherStock = async (data) => {
  try {
    const response = await api.post('/other-stock/transfer', data);
    return response.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to transfer other stock');
  }
};

// Delete Other Stock item with password verification (DELETE /api/other-stock/:id)
export const deleteOtherStock = async (id, password) => {
  try {
    const response = await api.delete(`/other-stock/${id}`, {
      data: { password },
      headers: { 'x-confirm-password': password }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to delete other stock');
  }
};

// Send Other Stock to Repair (PATCH /api/other-stock/:id/repair)
export const sendToRepair = async (id, quantity, notes) => {
  try {
    const response = await api.patch(`/other-stock/${id}/repair`, { quantity, notes });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to send item for repair');
  }
};

// Return Other Stock from Repair (PATCH /api/other-stock/:id/return-repair)
export const returnFromRepair = async (id, quantity, notes) => {
  try {
    const response = await api.patch(`/other-stock/${id}/return-repair`, { quantity, notes });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to return item from repair');
  }
};


// Delete Other Stock Repair Log entry (DELETE /api/other-stock/repair-log/:logId)
export const deleteRepairLog = async (logId) => {
  try {
    const response = await api.delete(`/other-stock/repair-log/${logId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to delete repair log entry');
  }
};

export const otherStockService = {
  getOtherStocks,
  createOtherStock,
  updateOtherStock,
  transferOtherStock,
  deleteOtherStock,
  sendToRepair,
  returnFromRepair,
  deleteRepairLog
};

export default otherStockService;


