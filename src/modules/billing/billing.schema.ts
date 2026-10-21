import { z } from "zod";

export const generateInvoiceSchema = z.object({
  leaseId: z.string().uuid("Invalid lease ID"),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  includeUnbilledElectricity: z.boolean().default(true),
  amountOther: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const batchGenerateInvoicesSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  billingMonth: z.coerce.number().int().min(1).max(12),
  billingYear: z.coerce.number().int().min(2020),
  dueDay: z.coerce.number().int().min(1).max(28).default(5),
  includeUnbilledElectricity: z.boolean().default(true),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  amount: z.coerce.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.enum(["bank_transfer", "qris", "cash", "va", "midtrans", "xendit"]),
  proofUrl: z.string().url().optional(),
  notes: z.string().optional(),
  autoApprove: z.boolean().default(false), // e.g. for cash paid directly to owner
});

export const verifyPaymentSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  notes: z.string().optional(),
});

export const applyPenaltySchema = z.object({
  penaltyType: z.enum(["fixed_daily", "percentage"]).default("fixed_daily"),
  fixedAmountPerDay: z.coerce.number().min(0).default(25000), // Rp 25.000 / day
  percentageRate: z.coerce.number().min(0).max(100).default(5), // 5%
  branchId: z.string().uuid().optional(),
});

export const queryInvoiceSchema = z.object({
  branchId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  status: z.enum(["unpaid", "partially_paid", "paid", "overdue", "cancelled"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type BatchGenerateInvoicesInput = z.infer<typeof batchGenerateInvoicesSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type ApplyPenaltyInput = z.infer<typeof applyPenaltySchema>;
export type QueryInvoiceInput = z.infer<typeof queryInvoiceSchema>;
