import { z } from "zod";

export const createTaskSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  roomId: z.string().uuid("Invalid room ID").optional(),
  assignedTo: z.string().uuid("Invalid assignee ID").optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  taskType: z.enum(["housekeeping", "maintenance", "inspection", "asset_service"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  cost: z.coerce.number().min(0).default(0),
  beforePhotoUrl: z.string().url().optional(),
  scheduledDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["todo", "in_progress", "completed", "verified"]).optional(),
  afterPhotoUrl: z.string().url().optional(),
  cost: z.coerce.number().min(0).optional(),
});

export const completeTaskSchema = z.object({
  afterPhotoUrl: z.string().url().optional(),
  cost: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const queryTaskSchema = z.object({
  branchId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  taskType: z.enum(["housekeeping", "maintenance", "inspection", "asset_service"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "completed", "verified"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type QueryTaskInput = z.infer<typeof queryTaskSchema>;
