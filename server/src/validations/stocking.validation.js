import { z } from "zod";
import { MEDICINE_TYPES, ALL_VALID_MEDICINE_TYPES } from "../constants/medicineTypes.js";

/*
 * Create Site-Level Stock
 */
export const createStockingSchema = z.object({

    siteId: z
        .string()
        .min(1, "Site is required"),

    category: z.enum(
        ["FEED", "MEDICINE", "SEED"],
        {
            errorMap: () => ({
                message:
                    "Category must be FEED, MEDICINE or SEED"
            })
        }
    ),

    medicineType: z
        .string()
        .optional()
        .nullable(),

    notes: z
        .string()
        .optional()
        .nullable(),

    totalQuantity: z
        .number()
        .positive(
            "Total quantity must be greater than 0"
        ),

    unit: z
        .string()
        .min(1, "Unit is required")
        .optional(),

    costPerKg: z
        .number()
        .positive(
            "Cost per kg must be greater than 0"
        )
        .optional(),

    stockingDate: z
        .string()
        .optional()

}).superRefine((data, ctx) => {

    /*
     * When Medicine is selected, validate Medicine Type if provided.
     */
    if (data.category === "MEDICINE" && data.medicineType) {
        if (!ALL_VALID_MEDICINE_TYPES.includes(data.medicineType)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["medicineType"],
                message: `Medicine Type must be one of: ${MEDICINE_TYPES.join(", ")}`
            });
        }
    }

    /*
     * Seed must have cost per kg.
     */
    if (
        data.category === "SEED" &&
        data.costPerKg === undefined
    ) {

        ctx.addIssue({

            code: z.ZodIssueCode.custom,

            path: ["costPerKg"],

            message:
                "Cost per kg is required for SEED"

        });

    }


    /*
     * Feed and Medicine should not
     * receive a cost per kg through
     * the Stocking page.
     */
    if (
        data.category !== "SEED" &&
        data.costPerKg !== undefined
    ) {

        ctx.addIssue({

            code: z.ZodIssueCode.custom,

            path: ["costPerKg"],

            message:
                "Cost per kg is only applicable for SEED"

        });

    }

});


/*
 * Allocate Stock to Site (Legacy)
 */
export const allocateStockSchema = z.object({

    siteId: z
        .string()
        .min(1, "Site is required"),

    allocatedQuantity: z
        .number()
        .positive(
            "Allocated quantity must be greater than 0"
        ),

    unit: z
        .string()
        .min(1, "Unit is required")
        .optional()

});


/*
 * Transfer Stock Between Sites
 */
export const transferStockSchema = z.object({
    fromSiteId: z
        .string()
        .min(1, "Source site is required"),

    toSiteId: z
        .string()
        .min(1, "Destination site is required"),

    category: z.enum(
        ["FEED", "MEDICINE"],
        {
            errorMap: () => ({
                message: "Stock category must be FEED or MEDICINE"
            })
        }
    ),

    quantity: z
        .number()
        .positive("Transfer quantity must be greater than 0"),

    medicineType: z
        .string()
        .optional()
        .nullable()
}).refine(
    (data) => data.fromSiteId !== data.toSiteId,
    {
        message: "Source site and destination site must be different",
        path: ["toSiteId"]
    }
).refine(
    (data) => {
        if (data.category === "MEDICINE") {
            return Boolean(data.medicineType && MEDICINE_TYPES.includes(data.medicineType));
        }
        return true;
    },
    {
        message: `Medicine Type is required for Medicine transfer. Must be one of: ${MEDICINE_TYPES.join(", ")}`,
        path: ["medicineType"]
    }
);