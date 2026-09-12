import { Router } from "express";

import auth from "../middleware/auth.middleware.js";

import {
    getReportTanksController,
    getActiveTankReportController,
    getCompletedCropsController,
    getCompletedCropReportController,
    getFarmOverviewReportController,
    getSiteOverviewReportController
} from "../controllers/report.controller.js";

const router = Router();

/* ---------------------------------------------
   Get Farm Overview Report (All Ponds)
----------------------------------------------*/
router.get(
    "/farm-overview",
    auth,
    getFarmOverviewReportController
);

/* ---------------------------------------------
   Get Site Overview Report (All Ponds in Site)
----------------------------------------------*/
router.get(
    "/site/:siteId",
    auth,
    getSiteOverviewReportController
);

/* ---------------------------------------------
   Get All Tanks for Reports
----------------------------------------------*/
router.get(
    "/tanks",
    auth,
    getReportTanksController
);

/* ---------------------------------------------
   Get Active Tank Report
----------------------------------------------*/
router.get(
    "/tank/:tankId/active",
    auth,
    getActiveTankReportController
);

/* ---------------------------------------------
   Get Completed Crops of a Tank
----------------------------------------------*/
router.get(
    "/tank/:tankId/completed",
    auth,
    getCompletedCropsController
);

/* ---------------------------------------------
   Get Completed Crop Report
----------------------------------------------*/
router.get(
    "/crop/:cropId",
    auth,
    getCompletedCropReportController
);

export default router;