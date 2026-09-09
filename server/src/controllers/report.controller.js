import {
    getReportTanks,
    getActiveTankReport,
    getCompletedCrops,
    getCompletedCropReport,
    getFarmOverviewReport
} from "../services/report.service.js";

/* ---------------------------------------------
   Get All Tanks for Reports
----------------------------------------------*/

export const getReportTanksController = async (req, res) => {

    try {

        const tanks = await getReportTanks(

            req.user.id

        );

        return res.status(200).json({

            success: true,

            message: "Report tanks fetched successfully",

            data: tanks

        });

    } catch (error) {

        return res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

/* ---------------------------------------------
   Get Active Tank Report
----------------------------------------------*/

export const getActiveTankReportController = async (req, res) => {

    try {

        const report = await getActiveTankReport(

            req.user.id,

            req.params.tankId

        );

        return res.status(200).json({

            success: true,

            message: "Active tank report fetched successfully",

            data: report

        });

    } catch (error) {

        return res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

/* ---------------------------------------------
   Get Completed Crops
----------------------------------------------*/

export const getCompletedCropsController = async (req, res) => {

    try {

        const crops = await getCompletedCrops(

            req.user.id,

            req.params.tankId

        );

        return res.status(200).json({

            success: true,

            message: "Completed crops fetched successfully",

            data: crops

        });

    } catch (error) {

        return res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

/* ---------------------------------------------
   Get Completed Crop Report
----------------------------------------------*/

export const getCompletedCropReportController = async (req, res) => {

    try {

        const report = await getCompletedCropReport(

            req.user.id,

            req.params.cropId

        );

        return res.status(200).json({

            success: true,

            message: "Completed crop report fetched successfully",

            data: report

        });

    } catch (error) {

        return res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

/* ---------------------------------------------
   Get Farm Overview Report (All Ponds Combined)
----------------------------------------------*/
export const getFarmOverviewReportController = async (req, res) => {
    try {
        const report = await getFarmOverviewReport(req.user.id);
        return res.status(200).json({
            success: true,
            message: "Farm overview report fetched successfully",
            data: report
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};