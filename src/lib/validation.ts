import { z } from "zod";
import { isValidDateKey } from "@/lib/dates";
import { MAX_AMOUNT } from "@/lib/money";
import { formulaSchema } from "@/lib/formula/tokens";
import { ICON_NAMES } from "@/lib/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour");

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name must be 60 characters or fewer"),
  description: optionalText(240),
  color: hexColor,
  icon: z.string().refine((v) => ICON_NAMES.includes(v), "Pick an icon"),
  type: z.enum(["NORMAL", "CALCULATED"]),
  formula: formulaSchema.optional().nullable(),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const categoryUpdateSchema = categoryInputSchema.partial();

export const dateKeySchema = z
  .string({ required_error: "Date is required" })
  .refine(isValidDateKey, "Enter a valid date");

export const amountSchema = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a number")
  .positive("Amount must be greater than 0")
  .max(MAX_AMOUNT, "Amount is too large")
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Use at most 2 decimal places");

export const expenseInputSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  particular: z.string().trim().min(1, "Particular is required").max(120, "Keep it under 120 characters"),
  amount: amountSchema,
  expenseDate: dateKeySchema,
  description: optionalText(500),
  notes: optionalText(1000),
});
export type ExpenseInput = z.input<typeof expenseInputSchema>;
export type ExpenseValues = z.output<typeof expenseInputSchema>;

export const expenseBatchSchema = z.object({
  expenses: z.array(expenseInputSchema).min(1, "Add at least one expense").max(200, "Up to 200 rows at a time"),
});

export const dashboardPrefsSchema = z.object({
  defaultRange: z.enum(["today", "week", "month", "year", "all", "custom"]).default("month"),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
  showCalculatedOnDashboard: z.boolean().default(true),
  visibleCharts: z
    .object({
      donut: z.boolean().default(true),
      monthly: z.boolean().default(true),
      trend: z.boolean().default(true),
      top: z.boolean().default(true),
      cumulative: z.boolean().default(true),
    })
    .default({}),
});

export const settingsSchema = z.object({
  currency: z.string().min(3).max(3),
  dateFormat: z.string().min(1).max(20),
  dashboard: dashboardPrefsSchema,
});

export const backupSchema = z.object({
  // "spendly" = files exported before the app was renamed; still importable.
  app: z.enum(["totalio", "spendly"]),
  version: z.number().int(),
  exportedAt: z.string(),
  settings: settingsSchema.partial().optional(),
  categories: z
    .array(
      z.object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
        color: z.string(),
        icon: z.string(),
        type: z.enum(["NORMAL", "CALCULATED"]),
        formula: formulaSchema.nullable().optional(),
        createdAt: z.string().optional(),
      }),
    )
    .max(5000),
  expenses: z
    .array(
      z.object({
        id: z.string().optional(),
        categoryId: z.string(),
        particular: z.string(),
        amount: z.number(),
        expenseDate: z.string(),
        description: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        createdAt: z.string().optional(),
      }),
    )
    .max(500000),
});
export type Backup = z.infer<typeof backupSchema>;
