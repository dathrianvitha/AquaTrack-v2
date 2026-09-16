import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import verifyPassword from "../middleware/verifyPassword.middleware.js";
import validate from "../middleware/validate.middleware.js";

import {
  createNettingController,
  getNettingsController,
  updateNettingController,
  deleteNettingController
} from "../controllers/netting.controller.js";

import {
  createNettingSchema,
  updateNettingSchema
} from "../validations/netting.validation.js";

const router = Router();

router.post(
  "/",
  auth,
  validate(createNettingSchema),
  createNettingController
);

router.get(
  "/",
  auth,
  getNettingsController
);

router.put(
  "/:id",
  auth,
  validate(updateNettingSchema),
  updateNettingController
);

router.delete(
  "/:id",
  auth,
  verifyPassword,
  deleteNettingController
);

export default router;
