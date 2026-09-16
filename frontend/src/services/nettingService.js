import api from './api';

/**
 * Netting Management Service
 */
export const getNettings = async (params = {}) => {
  try {
    const response = await api.get('/netting', { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch netting records');
  }
};

export const createNetting = async (data) => {
  try {
    const response = await api.post('/netting', data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to create netting record');
  }
};

export const updateNetting = async (id, data) => {
  try {
    const response = await api.put(`/netting/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || `Failed to update netting record #${id}`);
  }
};

export const deleteNetting = async (id, password) => {
  try {
    const response = await api.delete(`/netting/${id}`, {
      data: { password },
      headers: { 'x-confirm-password': password }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || `Failed to delete netting record #${id}`);
  }
};

export const nettingService = {
  getNettings,
  createNetting,
  updateNetting,
  deleteNetting
};

export default nettingService;
