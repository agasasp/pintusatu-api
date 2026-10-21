import { z } from "zod";

export const createRoomSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  roomNumber: z.string().min(1, "Room number is required"),
  floor: z.coerce.number().int().min(1).default(1),
  type: z.string().min(2, "Room type is required"),
  basePrice: z.coerce.number().positive("Base price must be positive"),
  dailyPrice: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).default(500000),
  status: z.enum(["available", "occupied", "maintenance", "reserved"]).default("available"),
  facilities: z.array(z.string()).optional(),
  meterInitial: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const updateRoomSchema = createRoomSchema.partial().omit({ branchId: true });

export const updateRoomStatusSchema = z.object({
  status: z.enum(["available", "occupied", "maintenance", "reserved"]),
  notes: z.string().optional(),
});

export const queryRoomSchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.enum(["available", "occupied", "maintenance", "reserved"]).optional(),
  type: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  floor: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
export type QueryRoomInput = z.infer<typeof queryRoomSchema>;
