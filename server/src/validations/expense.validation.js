import { z } from "zod";

export const expenseCategories = [
    "Pond Preparation",
    "Seed Cost",
    "Electricity",
    "Generator & Diesel",
    "Labour",
    "Maintenance",
    "Salaries",
    "Pond Lease"
];

export const paymentModes = [
    "CASH",
    "UPI",
    "BANK",
    "CARD"
];

const baseExpenseSchema = z.object({

    tankId: z.string().optional().nullable(),

    siteId: z.string().optional().nullable(),

    category: z.string().refine((val) => expenseCategories.includes(val), {
        message: "Invalid expense category"
    }),

    description: z.string().optional().nullable(),

    amount: z.coerce.number().positive("Amount must be greater than 0"),

    paymentMode: z.preprocess(
        (val) => {
            if (!val) return "CASH";
            const upper = String(val).toUpperCase().trim();
            if (upper.includes("UPI") || upper.includes("NET") || upper.includes("BANK") || upper.includes("ONLINE")) {
                return "UPI";
            }
            if (upper.includes("CARD")) {
                return "CARD";
            }
            return "CASH";
        },
        z.enum(["CASH", "UPI", "BANK", "CARD"])
    ),

    date: z.string(),

    notes: z.string().optional().nullable()

});

export const createExpenseSchema = baseExpenseSchema.refine(
    (data) => Boolean(data.tankId || data.siteId),
    {
        message: "Tank or Site is required",
        path: ["tankId"]
    }
);

export const updateExpenseSchema = baseExpenseSchema.partial();