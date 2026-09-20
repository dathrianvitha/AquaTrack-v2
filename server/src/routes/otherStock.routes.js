import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import verifyPassword from "../middleware/verifyPassword.middleware.js";
import validate from "../middleware/validate.middleware.js";

import {
  getOtherStocksController,
  createOtherStockController,
  updateOtherStockController,
  deleteOtherStockController,
  transferOtherStockController,
  sendToRepairController,
  returnFromRepairController,
  deleteOtherStockRepairLogController
} from "../controllers/otherStock.controller.js";

import {
  createOtherStockSchema,
  updateOtherStockSchema,
  transferOtherStockSchema,
  sendToRepairSchema,
  returnFromRepairSchema
} from "../validations/otherStock.validation.js";

const router = Router();

/*
 * Get all Other Stock items
 */
router.get("/", auth, getOtherStocksController);

/*
 * Create Other Stock item
 */
router.post(
  "/",
  auth,
  validate(createOtherStockSchema),
  createOtherStockController
);

/*
 * Transfer Other Stock item
 */
router.post(
  "/transfer",
  auth,
  validate(transferOtherStockSchema),
  transferOtherStockController
);

/*
 * Send Other Stock to Repair
 */
router.patch(
  "/:id/repair",
  auth,
  validate(sendToRepairSchema),
  sendToRepairController
);

/*
 * Return Other Stock from Repair
 */
router.patch(
  "/:id/return-repair",
  auth,
  validate(returnFromRepairSchema),
  returnFromRepairController
);

/*
 * Delete Other Stock Repair Log entry
 */
router.delete("/repair-log/:logId", auth, deleteOtherStockRepairLogController);

/*
 * Update Other Stock item
 */
router.put(
  "/:id",
  auth,
  validate(updateOtherStockSchema),
  updateOtherStockController
);

/*
 * Delete Other Stock item (requires password verification)
 */
router.delete("/:id", auth, verifyPassword, deleteOtherStockController);

export default router;


