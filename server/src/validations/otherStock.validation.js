import { z } from "zod";
import {
  ALL_VALID_OTHER_STOCK_CATEGORIES,
  OTHER_STOCK_SUBCATEGORIES,
  normalizeOtherStockCategory
} from "../constants/otherStockCategories.js";

/*
 * Create Other Stock Validation Schema
 */
export const createOtherStockSchema = z.object({
  category: z.enum(ALL_VALID_OTHER_STOCK_CATEGORIES, {
    errorMap: () => ({
      message: `Category must be one of: ${ALL_VALID_OTHER_STOCK_CATEGORIES.join(", ")}`
    })
  }),

  subcategory: z.string().optional().nullable(),

  count: z.coerce
    .number({
      invalid_type_error: "Count must be a number",
      required_error: "Count is required"
    })
    .int("Count must be a whole number")
    .positive("Count must be greater than 0"),

  siteId: z.string().optional().nullable(),

  notes: z.string().optional().nullable()
}).superRefine((data, ctx) => {
  const normCat = normalizeOtherStockCategory(data.category);
  const allowedSubs = OTHER_STOCK_SUBCATEGORIES[normCat] || OTHER_STOCK_SUBCATEGORIES[data.category];

  if (allowedSubs) {
    if (!data.subcategory || !allowedSubs.includes(data.subcategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subcategory"],
        message: `Subcategory is required for ${normCat}. Must be one of: ${allowedSubs.join(", ")}`
      });
    }
  }
});

/*
 * Update Other Stock Validation Schema
 */
export const updateOtherStockSchema = z.object({
  category: z
    .enum(ALL_VALID_OTHER_STOCK_CATEGORIES, {
      errorMap: () => ({
        message: `Category must be one of: ${ALL_VALID_OTHER_STOCK_CATEGORIES.join(", ")}`
      })
    })
    .optional(),

  subcategory: z.string().optional().nullable(),

  count: z.coerce
    .number({
      invalid_type_error: "Count must be a number"
    })
    .int("Count must be a whole number")
    .positive("Count must be greater than 0")
    .optional(),

  siteId: z.string().optional().nullable(),

  notes: z.string().optional().nullable()
}).superRefine((data, ctx) => {
  if (data.category) {
    const normCat = normalizeOtherStockCategory(data.category);
    const allowedSubs = OTHER_STOCK_SUBCATEGORIES[normCat] || OTHER_STOCK_SUBCATEGORIES[data.category];

    if (allowedSubs && data.subcategory) {
      if (!allowedSubs.includes(data.subcategory)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subcategory"],
          message: `Subcategory must be one of: ${allowedSubs.join(", ")}`
        });
      }
    }
  }
});

/*
 * Transfer Other Stock Validation Schema
 */
export const transferOtherStockSchema = z.object({
  fromSiteId: z.string({
    required_error: "From Site is required"
  }).min(1, "From Site is required"),

  toSiteId: z.string({
    required_error: "Destination site is required"
  }).min(1, "Destination site is required"),

  category: z.enum(ALL_VALID_OTHER_STOCK_CATEGORIES, {
    errorMap: () => ({
      message: `Category must be one of: ${ALL_VALID_OTHER_STOCK_CATEGORIES.join(", ")}`
    })
  }),

  subcategory: z.string().optional().nullable(),

  count: z.coerce
    .number({
      invalid_type_error: "Transfer quantity must be a number",
      required_error: "Transfer quantity is required"
    })
    .int("Transfer quantity must be a whole number")
    .positive("Transfer quantity must be greater than 0")
}).superRefine((data, ctx) => {
  if (data.fromSiteId === data.toSiteId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toSiteId"],
      message: "Source site and destination site must be different"
    });
  }

  const normCat = normalizeOtherStockCategory(data.category);
  const allowedSubs = OTHER_STOCK_SUBCATEGORIES[normCat] || OTHER_STOCK_SUBCATEGORIES[data.category];

  if (allowedSubs) {
    if (!data.subcategory || !allowedSubs.includes(data.subcategory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subcategory"],
        message: `Subcategory is required for ${normCat}. Must be one of: ${allowedSubs.join(", ")}`
      });
    }
  }
});

/*
 * Send To Repair Validation Schema
 */
export const sendToRepairSchema = z.object({
  quantity: z.coerce
    .number({
      invalid_type_error: "Quantity must be a number",
      required_error: "Quantity is required"
    })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0"),

  notes: z.string().optional()
});

/*
 * Return From Repair Validation Schema
 */
export const returnFromRepairSchema = z.object({
  quantity: z.coerce
    .number({
      invalid_type_error: "Quantity must be a number",
      required_error: "Quantity is required"
    })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0"),

  notes: z.string().optional()
});
