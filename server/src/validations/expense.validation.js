import { z } from "zod";

export const expenseCategories = [
    "Pond Preparation",
    "Seed Cost",
    "Electricity",
    "Generator & Diesel",
    "Labour",
    "Maintenance",
    "Salaries"
];

export const paymentModes = [
    "CASH",
    "UPI"
];

const baseExpenseSchema = z.object({

    tankId: z.string().optional(),

    siteId: z.string().optional(),

    category: z.enum(expenseCategories),

    description: z.string().min(3),

    amount: z.number().positive(),

    paymentMode: z.enum(paymentModes),

    date: z.string(),

    notes: z.string().optional()

});

export const createExpenseSchema = baseExpenseSchema.refine(
    (data) => data.tankId || data.siteId,
    {
        message: "Tank or Site is required",
        path: ["tankId"]
    }
);

export const updateExpenseSchema = baseExpenseSchema.partial();