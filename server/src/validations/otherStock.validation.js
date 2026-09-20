import { z } from "zod";

const validCategories = ["Motors", "Aerators", "Spare Parts", "Generators"];

/*
 * Create Other Stock Validation Schema
 */
export const createOtherStockSchema = z.object({
  category: z.enum(["Motors", "Aerators", "Spare Parts", "Generators"], {
    errorMap: () => ({
      message: "Category must be one of: Motors, Aerators, Spare Parts, Generators"
    })
  }),

  count: z.coerce
    .number({
      invalid_type_error: "Count must be a number",
      required_error: "Count is required"
    })
    .int("Count must be a whole number")
    .positive("Count must be greater than 0"),

  siteId: z.string().optional(),

  notes: z.string().optional()
});

/*
 * Update Other Stock Validation Schema
 */
export const updateOtherStockSchema = z.object({
  category: z
    .enum(["Motors", "Aerators", "Spare Parts", "Generators"], {
      errorMap: () => ({
        message: "Category must be one of: Motors, Aerators, Spare Parts, Generators"
      })
    })
    .optional(),

  count: z.coerce
    .number({
      invalid_type_error: "Count must be a number"
    })
    .int("Count must be a whole number")
    .positive("Count must be greater than 0")
    .optional(),

  siteId: z.string().optional(),

  notes: z.string().optional()
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

  category: z.enum(["Motors", "Aerators", "Spare Parts", "Generators"], {
    errorMap: () => ({
      message: "Category must be one of: Motors, Aerators, Spare Parts, Generators"
    })
  }),

  count: z.coerce
    .number({
      invalid_type_error: "Transfer quantity must be a number",
      required_error: "Transfer quantity is required"
    })
    .int("Transfer quantity must be a whole number")
    .positive("Transfer quantity must be greater than 0")
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



