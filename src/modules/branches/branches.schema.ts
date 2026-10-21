import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(3, "Branch name must be at least 3 characters"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  province: z.string().min(2, "Province is required"),
  postalCode: z.string().optional(),
  coordinates: z.string().optional(),
  phone: z.string().optional(),
  electricityBillingMode: z.enum(["token", "meter", "flat"]).default("meter"),
  kwhRate: z.coerce.number().min(0).default(2000),
  kwhAdminFee: z.coerce.number().min(0).default(15000),
  rules: z.string().optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const assignStaffSchema = z.object({
  staffId: z.string().uuid("Invalid staff ID"),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;
