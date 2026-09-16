import { z } from "zod";

export const createNettingSchema = z.object({
  siteId: z
    .string()
    .min(1, "Site is required"),

  tankId: z
    .string()
    .min(1, "Tank is required"),

  shrimpCount: z
    .coerce
    .number({ invalid_type_error: "Shrimp count must be a number" })
    .int("Shrimp count must be a whole number")
    .positive("Shrimp count must be greater than 0"),

  nettingDate: z
    .string()
    .min(1, "Netting date is required")
});

export const updateNettingSchema = z.object({
  shrimpCount: z
    .coerce
    .number({ invalid_type_error: "Shrimp count must be a number" })
    .int("Shrimp count must be a whole number")
    .positive("Shrimp count must be greater than 0")
    .optional(),

  nettingDate: z
    .string()
    .min(1, "Netting date is required")
    .optional()
});
