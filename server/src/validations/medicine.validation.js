import { z } from "zod";
import { MEDICINE_TYPES, ALL_VALID_MEDICINE_TYPES } from "../constants/medicineTypes.js";

const baseMedicineSchema = z.object({

    tankId: z.string().min(1, "Tank is required"),

    medicineType: z.enum(MEDICINE_TYPES, {
        errorMap: () => ({
            message: `Medicine Type must be one of: ${MEDICINE_TYPES.join(", ")}`
        })
    }).optional(),

    medicineName: z.string().min(1, "Medicine Name is required"),

    purpose: z.string().optional().default("Water treatment"),

    dosage: z.string().optional().default("As required"),

    quantity: z.number().positive("Quantity used must be greater than zero"),

    cost: z.number().min(0, "Cost cannot be negative"),

    date: z.string().min(1, "Date is required"),

    notes: z.string().optional().nullable()

});

export const createMedicineSchema = baseMedicineSchema.superRefine((data, ctx) => {
    const resolvedType = data.medicineType || data.medicineName;
    if (!MEDICINE_TYPES.includes(resolvedType)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["medicineType"],
            message: `Medicine Type must be one of: ${MEDICINE_TYPES.join(", ")}`
        });
    }
});

export const updateMedicineSchema = z.object({

    medicineType: z.enum(ALL_VALID_MEDICINE_TYPES).optional(),

    medicineName: z.string().optional(),

    purpose: z.string().optional(),

    dosage: z.string().optional(),

    quantity: z.number().positive("Quantity used must be greater than zero").optional(),

    cost: z.number().min(0, "Cost cannot be negative").optional(),

    date: z.string().optional(),

    notes: z.string().optional().nullable()

});