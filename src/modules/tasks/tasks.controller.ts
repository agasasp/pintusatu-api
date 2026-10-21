import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { TasksService } from "./tasks.service.js";
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  queryTaskSchema,
} from "./tasks.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  authMiddleware,
  requireOwner,
  requireStaffOrOwner,
} from "../../middlewares/auth.js";

export const taskRoutes = new Hono();

taskRoutes.use("*", authMiddleware());

// GET /api/tasks (List tasks)
taskRoutes.get(
  "/",
  requireStaffOrOwner,
  zValidator("query", queryTaskSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await TasksService.listTasks(query, user);
      return successResponse(
        c,
        result.items,
        "Tasks retrieved successfully",
        200,
        result.meta
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve tasks", 400);
    }
  }
);

// GET /api/tasks/:id (Task detail)
taskRoutes.get("/:id", requireStaffOrOwner, async (c) => {
  try {
    const id = c.req.param("id");
    const task = await TasksService.getTaskById(id);
    return successResponse(c, task, "Task retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve task", 404);
  }
});

// POST /api/tasks (Create task)
taskRoutes.post(
  "/",
  requireStaffOrOwner,
  zValidator("json", createTaskSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const task = await TasksService.createTask(user, input);
      return successResponse(c, task, "Task created successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to create task", 400);
    }
  }
);

// PUT /api/tasks/:id (Update task)
taskRoutes.put(
  "/:id",
  requireStaffOrOwner,
  zValidator("json", updateTaskSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await TasksService.updateTask(id, input);
      return successResponse(c, updated, "Task updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update task", 400);
    }
  }
);

// POST /api/tasks/:id/complete (Complete task - Penjaga)
taskRoutes.post(
  "/:id/complete",
  requireStaffOrOwner,
  zValidator("json", completeTaskSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const result = await TasksService.completeTask(id, user, input);
      return successResponse(c, result, "Task marked as completed");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to complete task", 400);
    }
  }
);

// POST /api/tasks/:id/verify (Verify task - Owner only)
taskRoutes.post("/:id/verify", requireOwner, async (c) => {
  try {
    const id = c.req.param("id");
    const result = await TasksService.verifyTask(id);
    return successResponse(c, result, "Task marked as verified");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to verify task", 400);
  }
});
