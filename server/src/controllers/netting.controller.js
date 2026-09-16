import {
  createNetting,
  getNettings,
  updateNetting,
  deleteNetting
} from "../services/netting.service.js";

export const createNettingController = async (req, res) => {
  try {
    const netting = await createNetting(req.user.id, req.body);
    return res.status(201).json({
      success: true,
      message: "Netting record created successfully",
      data: netting
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getNettingsController = async (req, res) => {
  try {
    const { siteId, tankId } = req.query;
    const nettings = await getNettings(req.user.id, { siteId, tankId });
    return res.status(200).json({
      success: true,
      message: "Netting records fetched successfully",
      data: nettings
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateNettingController = async (req, res) => {
  try {
    const netting = await updateNetting(req.user.id, req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Netting record updated successfully",
      data: netting
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteNettingController = async (req, res) => {
  try {
    const result = await deleteNetting(req.user.id, req.params.id);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
