import { z } from "zod";

export const suspendOwnerSchema = z.object({
  reason: z.string().min(5, "Suspension reason is required"),
  deactivateLogin: z.boolean().default(false),
});

export const updateSubscriptionSchema = z.object({
  planName: z.enum(["starter", "pro", "enterprise"]),
  roomQuota: z.coerce.number().int().min(1),
  pricePerMonth: z.coerce.number().min(0),
  status: z.enum(["active", "suspended", "trial", "past_due"]),
});

export const impersonateSchema = z.object({
  ownerId: z.string().uuid("Invalid owner ID"),
});

export type SuspendOwnerInput = z.infer<typeof suspendOwnerSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type ImpersonateInput = z.infer<typeof impersonateSchema>;
