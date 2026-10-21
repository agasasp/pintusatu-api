import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../../config/db.js";
import { tasks, rooms, branches, users, financeTransactions } from "../../db/schema.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  CompleteTaskInput,
  QueryTaskInput,
} from "./tasks.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { calculatePagination } from "../../utils/response.js";

export class TasksService {
  /**
   * Create task (Housekeeping, Maintenance, AC service, Inspection)
   */
  static async createTask(user: AuthUser, input: CreateTaskInput) {
    const [task] = await db
      .insert(tasks)
      .values({
        branchId: input.branchId,
        roomId: input.roomId || null,
        assignedTo: input.assignedTo || null,
        createdBy: user.id,
        title: input.title,
        description: input.description || null,
        taskType: input.taskType,
        priority: input.priority,
        cost: input.cost.toString(),
        beforePhotoUrl: input.beforePhotoUrl || null,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
        status: "todo",
      })
      .returning();

    return task;
  }

  /**
   * List tasks with filters & pagination
   */
  static async listTasks(query: QueryTaskInput, user: AuthUser) {
    const conditions = [];

    if (query.branchId) conditions.push(eq(tasks.branchId, query.branchId));
    if (query.roomId) conditions.push(eq(tasks.roomId, query.roomId));
    if (query.taskType) conditions.push(eq(tasks.taskType, query.taskType));
    if (query.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query.status) conditions.push(eq(tasks.status, query.status));

    // If penjaga role, option to filter to assigned tasks by default
    if (user.role === "penjaga" && query.assignedTo) {
      conditions.push(eq(tasks.assignedTo, query.assignedTo));
    } else if (query.assignedTo) {
      conditions.push(eq(tasks.assignedTo, query.assignedTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(whereClause);

    const total = totalRes?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const items = await db.query.tasks.findMany({
      where: whereClause,
      limit: query.limit,
      offset,
      orderBy: [desc(tasks.createdAt)],
      with: {
        branch: {
          columns: { id: true, name: true, city: true },
        },
        room: {
          columns: { id: true, roomNumber: true, type: true },
        },
        assignee: {
          columns: { id: true, name: true, phone: true, role: true },
        },
        creator: {
          columns: { id: true, name: true, role: true },
        },
      },
    });

    const meta = calculatePagination(total, query.page, query.limit);
    return { items, meta };
  }

  /**
   * Get task detail by ID
   */
  static async getTaskById(taskId: string) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        branch: true,
        room: true,
        assignee: true,
        creator: true,
      },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    return task;
  }

  /**
   * Update task general fields
   */
  static async updateTask(taskId: string, input: UpdateTaskInput) {
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!existing) {
      throw new Error("Task not found");
    }

    const [updated] = await db
      .update(tasks)
      .set({
        ...(input.branchId && { branchId: input.branchId }),
        ...(input.roomId !== undefined && { roomId: input.roomId }),
        ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo }),
        ...(input.title && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.taskType && { taskType: input.taskType }),
        ...(input.priority && { priority: input.priority }),
        ...(input.status && { status: input.status }),
        ...(input.cost !== undefined && { cost: input.cost.toString() }),
        ...(input.beforePhotoUrl !== undefined && { beforePhotoUrl: input.beforePhotoUrl }),
        ...(input.afterPhotoUrl !== undefined && { afterPhotoUrl: input.afterPhotoUrl }),
        ...(input.scheduledDate && { scheduledDate: new Date(input.scheduledDate) }),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updated;
  }

  /**
   * Mark task as completed (Penjaga submits completion proof & expenses)
   */
  static async completeTask(taskId: string, user: AuthUser, input: CompleteTaskInput) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) {
      throw new Error("Task not found");
    }

    const completedAt = new Date();

    const [updated] = await db
      .update(tasks)
      .set({
        status: "completed",
        afterPhotoUrl: input.afterPhotoUrl || task.afterPhotoUrl,
        cost: input.cost.toString(),
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // If there is maintenance/supplies cost, record in finance
    if (input.cost > 0) {
      const category = task.taskType === "housekeeping" ? "cleaning_supplies" : "asset_maintenance";
      await db.insert(financeTransactions).values({
        branchId: task.branchId,
        userId: user.id,
        category,
        type: "expense",
        amount: input.cost.toString(),
        description: `Biaya pengerjaan tugas: ${task.title}`,
        receiptUrl: input.afterPhotoUrl || null,
        approvalStatus: user.role === "owner" ? "approved" : "pending",
      });
    }

    return updated;
  }

  /**
   * Verify completed task (Kost Owner verifies work)
   */
  static async verifyTask(taskId: string) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) {
      throw new Error("Task not found");
    }

    const [updated] = await db
      .update(tasks)
      .set({
        status: "verified",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updated;
  }
}
