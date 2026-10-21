import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { db } from "../../config/db.js";
import { rooms, branches, saasSubscriptions, leases, tenants } from "../../db/schema.js";
import type {
  CreateRoomInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
  QueryRoomInput,
} from "./rooms.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { calculatePagination } from "../../utils/response.js";

export class RoomsService {
  /**
   * Create a new room with SaaS quota check
   */
  static async createRoom(user: AuthUser, input: CreateRoomInput) {
    // 1. Verify branch exists and user has access
    const [branch] = await db
      .select({ id: branches.id, ownerId: branches.ownerId })
      .from(branches)
      .where(eq(branches.id, input.branchId))
      .limit(1);

    if (!branch) {
      throw new Error("Branch not found");
    }

    if (user.role === "owner" && branch.ownerId !== user.id) {
      throw new Error("Forbidden: You do not own this branch");
    }

    // 2. Check SaaS Room Quota
    const ownerId = branch.ownerId;
    const [subscription] = await db
      .select({ roomQuota: saasSubscriptions.roomQuota, isSuspended: saasSubscriptions.isSuspended })
      .from(saasSubscriptions)
      .where(eq(saasSubscriptions.ownerId, ownerId))
      .limit(1);

    if (subscription?.isSuspended) {
      throw new Error("Your SaaS subscription is suspended. Please contact support.");
    }

    const currentRoomsCountResult = await db
      .select({ count: sql<number>`count(${rooms.id})::int` })
      .from(rooms)
      .innerJoin(branches, eq(rooms.branchId, branches.id))
      .where(eq(branches.ownerId, ownerId));

    const totalRoomsCount = currentRoomsCountResult[0]?.count || 0;
    const quota = subscription?.roomQuota || 20;

    if (totalRoomsCount >= quota) {
      throw new Error(
        `Room quota limit reached (${totalRoomsCount}/${quota}). Please upgrade your SaaS plan.`
      );
    }

    // 3. Create room
    const [room] = await db
      .insert(rooms)
      .values({
        branchId: input.branchId,
        roomNumber: input.roomNumber,
        floor: input.floor,
        type: input.type,
        basePrice: input.basePrice.toString(),
        dailyPrice: input.dailyPrice ? input.dailyPrice.toString() : null,
        depositAmount: input.depositAmount.toString(),
        status: input.status,
        facilities: input.facilities ? JSON.stringify(input.facilities) : null,
        meterInitial: input.meterInitial.toString(),
        notes: input.notes || null,
      })
      .returning();

    return {
      ...room,
      facilities: room.facilities ? JSON.parse(room.facilities) : [],
    };
  }

  /**
   * List rooms with filters & pagination
   */
  static async listRooms(query: QueryRoomInput, user: AuthUser) {
    const conditions = [];

    if (query.branchId) {
      conditions.push(eq(rooms.branchId, query.branchId));
    }
    if (query.status) {
      conditions.push(eq(rooms.status, query.status));
    }
    if (query.type) {
      conditions.push(eq(rooms.type, query.type));
    }
    if (query.floor) {
      conditions.push(eq(rooms.floor, query.floor));
    }
    if (query.minPrice !== undefined) {
      conditions.push(gte(rooms.basePrice, query.minPrice.toString()));
    }
    if (query.maxPrice !== undefined) {
      conditions.push(lte(rooms.basePrice, query.maxPrice.toString()));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count for pagination
    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rooms)
      .where(whereClause);

    const total = totalRes?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const roomRecords = await db.query.rooms.findMany({
      where: whereClause,
      limit: query.limit,
      offset: offset,
      orderBy: [desc(rooms.createdAt)],
      with: {
        branch: {
          columns: { id: true, name: true, city: true, electricityBillingMode: true },
        },
        leases: {
          where: eq(leases.status, "active"),
          with: {
            tenant: {
              columns: { id: true, name: true, phone: true, email: true },
            },
          },
        },
      },
    });

    const parsedRooms = roomRecords.map((r) => ({
      ...r,
      facilities: r.facilities ? JSON.parse(r.facilities) : [],
      currentLease: r.leases[0] || null,
    }));

    const meta = calculatePagination(total, query.page, query.limit);

    return {
      items: parsedRooms,
      meta,
    };
  }

  /**
   * Get room detail by ID
   */
  static async getRoomById(roomId: string) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        branch: true,
        leases: {
          orderBy: [desc(leases.createdAt)],
          with: {
            tenant: true,
          },
        },
        tasks: {
          limit: 5,
          orderBy: [desc(rooms.createdAt)],
        },
      },
    });

    if (!room) {
      throw new Error("Room not found");
    }

    return {
      ...room,
      facilities: room.facilities ? JSON.parse(room.facilities) : [],
      activeLease: room.leases.find((l: { status: string }) => l.status === "active") || null,
    };
  }

  /**
   * Update room
   */
  static async updateRoom(roomId: string, input: UpdateRoomInput) {
    const [existing] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!existing) {
      throw new Error("Room not found");
    }

    const [updated] = await db
      .update(rooms)
      .set({
        ...(input.roomNumber && { roomNumber: input.roomNumber }),
        ...(input.floor !== undefined && { floor: input.floor }),
        ...(input.type && { type: input.type }),
        ...(input.basePrice !== undefined && { basePrice: input.basePrice.toString() }),
        ...(input.dailyPrice !== undefined && { dailyPrice: input.dailyPrice ? input.dailyPrice.toString() : null }),
        ...(input.depositAmount !== undefined && { depositAmount: input.depositAmount.toString() }),
        ...(input.status && { status: input.status }),
        ...(input.facilities && { facilities: JSON.stringify(input.facilities) }),
        ...(input.meterInitial !== undefined && { meterInitial: input.meterInitial.toString() }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, roomId))
      .returning();

    return {
      ...updated,
      facilities: updated.facilities ? JSON.parse(updated.facilities) : [],
    };
  }

  /**
   * Quick update room status
   */
  static async updateRoomStatus(roomId: string, input: UpdateRoomStatusInput) {
    const [updated] = await db
      .update(rooms)
      .set({
        status: input.status,
        ...(input.notes !== undefined && { notes: input.notes }),
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, roomId))
      .returning();

    if (!updated) {
      throw new Error("Room not found");
    }

    return updated;
  }

  /**
   * Delete room
   */
  static async deleteRoom(roomId: string) {
    // Check if room has active lease
    const [activeLease] = await db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.roomId, roomId), eq(leases.status, "active")))
      .limit(1);

    if (activeLease) {
      throw new Error("Cannot delete room with an active tenant lease. Please check out first.");
    }

    await db.delete(rooms).where(eq(rooms.id, roomId));
    return { message: "Room deleted successfully" };
  }
}
