import { z } from "zod";

export const recordReadingSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  roomId: z.string().uuid("Invalid room ID"),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2020).max(2100),
  mode: z.enum(["token", "meter", "flat"]),
  // Mode: meter specific fields
  currentReading: z.coerce.number().min(0).optional(),
  previousReading: z.coerce.number().min(0).optional(),
  customKwhRate: z.coerce.number().min(0).optional(),
  customAdminFee: z.coerce.number().min(0).optional(),
  meterPhotoUrl: z.string().url().optional(),
  // Mode: token specific fields
  tokenCode: z.string().optional(),
  tokenAmount: z.coerce.number().min(0).optional(),
  // Mode: flat specific fields
  flatAmount: z.coerce.number().min(0).optional(),
});

export const calculatePreviewSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  currentReading: z.coerce.number().min(0),
});

export const queryElectricitySchema = z.object({
  branchId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  periodYear: z.coerce.number().int().optional(),
  mode: z.enum(["token", "meter", "flat"]).optional(),
  isBilled: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const electricitySummaryQuerySchema = z.object({
  branchId: z.string().uuid(),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2020),
});

export type RecordReadingInput = z.infer<typeof recordReadingSchema>;
export type CalculatePreviewInput = z.infer<typeof calculatePreviewSchema>;
export type QueryElectricityInput = z.infer<typeof queryElectricitySchema>;
export type ElectricitySummaryQueryInput = z.infer<typeof electricitySummaryQuerySchema>;
