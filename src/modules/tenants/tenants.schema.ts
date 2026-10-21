import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email().optional(),
  phone: z.string().min(8, "Phone number is required"),
  identityType: z.enum(["ktp", "sim", "passport"]).default("ktp"),
  identityNumber: z.string().min(6, "Identity number is required"),
  identityPhotoUrl: z.string().url().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  occupation: z.string().optional(),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  status: z.enum(["active", "inactive", "blacklisted"]).optional(),
});

export const checkInSchema = z.object({
  tenantId: z.string().uuid("Invalid tenant ID"),
  roomId: z.string().uuid("Invalid room ID"),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  rentPrice: z.coerce.number().positive("Rent price must be positive"),
  depositPaid: z.coerce.number().min(0).default(0),
  billingCycleDay: z.coerce.number().int().min(1).max(28).default(1),
  paymentTerm: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).default("monthly"),
  electricityBillingModeOverride: z.enum(["default", "token", "meter", "flat"]).default("default"),
  generateInitialInvoice: z.boolean().default(true),
});

export const checkOutSchema = z.object({
  leaseId: z.string().uuid("Invalid lease ID"),
  checkOutDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  depositRefundAmount: z.coerce.number().min(0).default(0),
  deductionsAmount: z.coerce.number().min(0).default(0),
  deductionsReason: z.string().optional(),
  roomNextStatus: z.enum(["available", "maintenance"]).default("maintenance"),
  createCleaningTask: z.boolean().default(true),
});

export const queryTenantSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "inactive", "blacklisted"]).optional(),
  branchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type QueryTenantInput = z.infer<typeof queryTenantSchema>;
