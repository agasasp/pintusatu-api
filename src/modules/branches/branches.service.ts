import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { branches, rooms, leases, staffAssignments, users } from "../../db/schema.js";
import type { CreateBranchInput, UpdateBranchInput } from "./branches.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";

export class BranchesService {
  /**
   * Helper to generate a clean URL-friendly slug
   */
  private static generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Create a new Kost branch
   */
  static async createBranch(ownerId: string, input: CreateBranchInput) {
    const slug = this.generateSlug(input.name);

    const [branch] = await db
      .insert(branches)
      .values({
        ownerId,
        name: input.name,
        slug,
        address: input.address,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode || null,
        coordinates: input.coordinates || null,
        phone: input.phone || null,
        electricityBillingMode: input.electricityBillingMode,
        kwhRate: input.kwhRate.toString(),
        kwhAdminFee: input.kwhAdminFee.toString(),
        rules: input.rules || null,
      })
      .returning();

    return branch;
  }

  /**
   * List branches accessible by the user
   */
  static async listBranches(user: AuthUser) {
    if (user.role === "superadmin") {
      return await db.query.branches.findMany({
        with: {
          owner: {
            columns: { id: true, name: true, email: true },
          },
          rooms: {
            columns: { id: true, status: true },
          },
        },
      });
    }

    if (user.role === "penjaga") {
      // Find branches assigned to this staff
      const assignments = await db
        .select({ branchId: staffAssignments.branchId })
        .from(staffAssignments)
        .where(eq(staffAssignments.staffId, user.id));

      const branchIds = assignments.map((a) => a.branchId);
      if (branchIds.length === 0) return [];

      return await db.query.branches.findMany({
        where: inArray(branches.id, branchIds),
        with: {
          rooms: {
            columns: { id: true, status: true },
          },
        },
      });
    }

    // Owner: list all branches owned
    return await db.query.branches.findMany({
      where: eq(branches.ownerId, user.id),
      with: {
        rooms: {
          columns: { id: true, status: true },
        },
        staffAssignments: {
          with: {
            staff: {
              columns: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });
  }

  /**
   * Get single branch by ID with access check
   */
  static async getBranchById(branchId: string, user: AuthUser) {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
      with: {
        owner: {
          columns: { id: true, name: true, email: true },
        },
        rooms: true,
        staffAssignments: {
          with: {
            staff: {
              columns: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!branch) {
      throw new Error("Branch not found");
    }

    if (user.role === "owner" && branch.ownerId !== user.id) {
      throw new Error("Forbidden: You do not own this branch");
    }

    return branch;
  }

  /**
   * Update branch
   */
  static async updateBranch(branchId: string, ownerId: string, input: UpdateBranchInput) {
    const [existing] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.ownerId, ownerId)))
      .limit(1);

    if (!existing) {
      throw new Error("Branch not found or access denied");
    }

    const [updated] = await db
      .update(branches)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.address && { address: input.address }),
        ...(input.city && { city: input.city }),
        ...(input.province && { province: input.province }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
        ...(input.coordinates !== undefined && { coordinates: input.coordinates }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.electricityBillingMode && { electricityBillingMode: input.electricityBillingMode }),
        ...(input.kwhRate !== undefined && { kwhRate: input.kwhRate.toString() }),
        ...(input.kwhAdminFee !== undefined && { kwhAdminFee: input.kwhAdminFee.toString() }),
        ...(input.rules !== undefined && { rules: input.rules }),
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId))
      .returning();

    return updated;
  }

  /**
   * Delete branch
   */
  static async deleteBranch(branchId: string, ownerId: string) {
    const [existing] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.ownerId, ownerId)))
      .limit(1);

    if (!existing) {
      throw new Error("Branch not found or access denied");
    }

    await db.delete(branches).where(eq(branches.id, branchId));
    return { message: "Branch deleted successfully" };
  }

  /**
   * Assign staff to branch
   */
  static async assignStaff(branchId: string, staffId: string, ownerId: string) {
    // Verify branch belongs to owner
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.ownerId, ownerId)))
      .limit(1);

    if (!branch) {
      throw new Error("Branch not found or access denied");
    }

    // Verify staff exists and belongs to owner
    const [staff] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, staffId), eq(users.ownerId, ownerId)))
      .limit(1);

    if (!staff) {
      throw new Error("Staff member not found or does not belong to your account");
    }

    const [assignment] = await db
      .insert(staffAssignments)
      .values({
        branchId,
        staffId,
      })
      .returning();

    return assignment;
  }

  /**
   * Remove staff from branch
   */
  static async removeStaff(branchId: string, staffId: string, ownerId: string) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.ownerId, ownerId)))
      .limit(1);

    if (!branch) {
      throw new Error("Branch not found or access denied");
    }

    await db
      .delete(staffAssignments)
      .where(
        and(
          eq(staffAssignments.branchId, branchId),
          eq(staffAssignments.staffId, staffId)
        )
      );

    return { message: "Staff unassigned from branch successfully" };
  }

  /**
   * Get occupancy and revenue statistics for a branch
   */
  static async getBranchStats(branchId: string, user: AuthUser) {
    await this.getBranchById(branchId, user);

    const roomList = await db
      .select({
        id: rooms.id,
        status: rooms.status,
        basePrice: rooms.basePrice,
      })
      .from(rooms)
      .where(eq(rooms.branchId, branchId));

    const totalRooms = roomList.length;
    const occupied = roomList.filter((r) => r.status === "occupied").length;
    const available = roomList.filter((r) => r.status === "available").length;
    const maintenance = roomList.filter((r) => r.status === "maintenance").length;
    const reserved = roomList.filter((r) => r.status === "reserved").length;

    const occupancyRate = totalRooms > 0 ? Number(((occupied / totalRooms) * 100).toFixed(1)) : 0;

    // Active leases revenue
    const activeLeases = await db
      .select({
        rentPrice: leases.rentPrice,
      })
      .from(leases)
      .where(and(eq(leases.branchId, branchId), eq(leases.status, "active")));

    const totalMonthlyRevenue = activeLeases.reduce(
      (acc, curr) => acc + Number(curr.rentPrice),
      0
    );

    return {
      branchId,
      totalRooms,
      occupiedRooms: occupied,
      availableRooms: available,
      maintenanceRooms: maintenance,
      reservedRooms: reserved,
      occupancyRatePercent: occupancyRate,
      activeLeasesCount: activeLeases.length,
      estimatedMonthlyRevenue: totalMonthlyRevenue,
    };
  }
}
