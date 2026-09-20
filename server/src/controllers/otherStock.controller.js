import {
  getOtherStocksService,
  createOtherStockService,
  updateOtherStockService,
  deleteOtherStockService,
  transferOtherStockService,
  sendToRepairService,
  returnFromRepairService,
  deleteOtherStockRepairLogService,
  getOtherStockTransfersService
} from "../services/otherStock.service.js";

/*
 * Get all Other Stock records
 */
export const getOtherStocksController = async (req, res) => {
  try {
    const items = await getOtherStocksService(req.user.id);

    return res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Create Other Stock
 */
export const createOtherStockController = async (req, res) => {
  try {
    const item = await createOtherStockService(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: "Other stock created successfully",
      data: item
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Update Other Stock
 */
export const updateOtherStockController = async (req, res) => {
  try {
    const updatedItem = await updateOtherStockService(
      req.user.id,
      req.params.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Other stock updated successfully",
      data: updatedItem
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Transfer Other Stock
 */
export const transferOtherStockController = async (req, res) => {
  try {
    const result = await transferOtherStockService(req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Send Other Stock to Repair
 */
export const sendToRepairController = async (req, res) => {
  try {
    const result = await sendToRepairService(
      req.user.id,
      req.params.id,
      req.body.quantity,
      req.body.notes
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Return Other Stock from Repair
 */
export const returnFromRepairController = async (req, res) => {
  try {
    const result = await returnFromRepairService(
      req.user.id,
      req.params.id,
      req.body.quantity,
      req.body.notes
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Delete Other Stock Repair Log entry
 */
export const deleteOtherStockRepairLogController = async (req, res) => {
  try {
    const result = await deleteOtherStockRepairLogService(req.user.id, req.params.logId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Delete Other Stock
 */
export const deleteOtherStockController = async (req, res) => {
  try {
    const result = await deleteOtherStockService(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: result?.message || "Other stock deleted successfully"
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/*
 * Get Other Stock Transfer Logs
 */
export const getOtherStockTransfersController = async (req, res) => {
  try {
    const transfers = await getOtherStockTransfersService(req.user.id);

    return res.status(200).json({
      success: true,
      data: transfers
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


