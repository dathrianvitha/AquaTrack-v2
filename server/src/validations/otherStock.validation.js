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

  notes: z.string().optional()
});
