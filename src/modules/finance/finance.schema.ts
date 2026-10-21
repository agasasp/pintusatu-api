import { z } from "zod";

export const createTransactionSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  category: z.enum([
    "rental_income",
    "electricity_income",
    "deposit_income",
    "other_income",
    "cleaning_supplies",
    "asset_maintenance",
    "staff_salary",
    "electricity_utility",
    "water_utility",
    "wifi_utility",
    "petty_cash",
    "tax_license",
    "other_expense",
  ]),
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().min(3, "Description is required"),
  receiptUrl: z.string().url().optional(),
  transactionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

export const submitPettyCashSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  category: z.enum(["cleaning_supplies", "asset_maintenance", "petty_cash", "water_utility", "other_expense"]).default("petty_cash"),
  description: z.string().min(3, "Description is required"),
  receiptUrl: z.string().url("Valid receipt image URL is required for petty cash claim"),
});

export const approveTransactionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().optional(),
});

export const queryFinanceSchema = z.object({
  branchId: z.string().uuid().optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const noiQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  periodYear: z.coerce.number().int().min(2020),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type SubmitPettyCashInput = z.infer<typeof submitPettyCashSchema>;
export type ApproveTransactionInput = z.infer<typeof approveTransactionSchema>;
export type QueryFinanceInput = z.infer<typeof queryFinanceSchema>;
export type NoiQueryInput = z.infer<typeof noiQuerySchema>;
