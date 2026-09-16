import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import verifyPassword from "../middleware/verifyPassword.middleware.js";
import validate from "../middleware/validate.middleware.js";

import {
  getOtherStocksController,
  createOtherStockController,
  updateOtherStockController,
  deleteOtherStockController
} from "../controllers/otherStock.controller.js";

import {
  createOtherStockSchema,
  updateOtherStockSchema
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
