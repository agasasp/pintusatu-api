import { eq, and, sql, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../../config/db.js";
import {
  users,
  saasSubscriptions,
  branches,
  rooms,
  tenants,
  leases,
} from "../../db/schema.js";
import { env } from "../../config/env.js";
import type {
  SuspendOwnerInput,
  UpdateSubscriptionInput,
  ImpersonateInput,
} from "./superadmin.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";

export class SuperadminService {
  /**
   * Get Platform Overview & MRR (Monthly Recurring Revenue) metrics
   */
  static async getPlatformMetrics() {
    const subscriptions = await db.select().from(saasSubscriptions);

    const totalOwners = subscriptions.length;
    const activeSubs = subscriptions.filter((s) => s.status === "active" && !s.isSuspended);
    const trialSubs = subscriptions.filter((s) => s.status === "trial");
    const suspendedSubs = subscriptions.filter((s) => s.isSuspended || s.status === "suspended");

    // Monthly Recurring Revenue (MRR)
    const mrr = activeSubs.reduce((acc, curr) => acc + Number(curr.pricePerMonth), 0);
    const arr = mrr * 12;

    // Platform inventory stats
    const [roomsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(rooms);
    const [tenantsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
    const [activeLeasesRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leases)
      .where(eq(leases.status, "active"));

    // Plan distribution
    const planDistribution = {
      starter: subscriptions.filter((s) => s.planName === "starter").length,
      pro: subscriptions.filter((s) => s.planName === "pro").length,
      enterprise: subscriptions.filter((s) => s.planName === "enterprise").length,
    };

    return {
      mrr,
      arr,
      currency: "IDR",
      subscriptions: {
        total: totalOwners,
        active: activeSubs.length,
        trial: trialSubs.length,
        suspended: suspendedSubs.length,
      },
      inventory: {
        totalRoomsManaged: roomsRes?.count || 0,
        totalTenantsRegistered: tenantsRes?.count || 0,
        totalActiveOccupancies: activeLeasesRes?.count || 0,
      },
      planDistribution,
    };
  }

  /**
   * List all SaaS Kost Owners
   */
  static async listOwners() {
    return await db.query.users.findMany({
      where: eq(users.role, "owner"),
      orderBy: [desc(users.createdAt)],
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      with: {
        saasSubscriptions: true,
        branches: {
          columns: {
            id: true,
            name: true,
            city: true,
          },
          with: {
            rooms: {
              columns: { id: true, status: true },
            },
          },
        },
      },
    });
  }

  /**
   * Suspend a Kost Owner
   */
  static async suspendOwner(ownerId: string, input: SuspendOwnerInput) {
    const [owner] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
    if (!owner) {
      throw new Error("Owner account not found");
    }

    // 1. Update subscription
    await db
      .update(saasSubscriptions)
      .set({
        isSuspended: true,
        status: "suspended",
        suspensionReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(saasSubscriptions.ownerId, ownerId));

    // 2. Optionally deactivate login
    if (input.deactivateLogin) {
      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, ownerId));
    }

    return {
      message: `Owner ${owner.name} (${owner.email}) suspended successfully`,
      ownerId,
      reason: input.reason,
    };
  }

  /**
   * Reactivate suspended Kost Owner
   */
  static async reactivateOwner(ownerId: string) {
    const [owner] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
    if (!owner) {
      throw new Error("Owner account not found");
    }

    await db
      .update(saasSubscriptions)
      .set({
        isSuspended: false,
        status: "active",
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(saasSubscriptions.ownerId, ownerId));

    await db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(users.id, ownerId));

    return {
      message: `Owner ${owner.name} reactivated successfully`,
      ownerId,
    };
  }

  /**
   * Update subscription tier & room quota
   */
  static async updateSubscription(ownerId: string, input: UpdateSubscriptionInput) {
    const [updated] = await db
      .update(saasSubscriptions)
      .set({
        planName: input.planName,
        roomQuota: input.roomQuota,
        pricePerMonth: input.pricePerMonth.toString(),
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(saasSubscriptions.ownerId, ownerId))
      .returning();

    if (!updated) {
      throw new Error("Subscription record not found");
    }

    return updated;
  }

  /**
   * Generate Owner Impersonation JWT Token
   * Allows superadmin to access the platform acting as the owner with audit claims
   */
  static async generateImpersonationToken(superadmin: AuthUser, ownerId: string) {
    const [targetOwner] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);

    if (!targetOwner) {
      throw new Error("Target owner not found");
    }

    if (targetOwner.role !== "owner") {
      throw new Error("Target user is not a Kost Owner");
    }

    const payload = {
      id: targetOwner.id,
      name: targetOwner.name,
      email: targetOwner.email,
      role: targetOwner.role,
      isImpersonated: true,
      impersonatedBy: superadmin.id,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: "2h", // Shorter lifespan for impersonation
    });

    console.log(
      `🛡️ [Superadmin Audit] Superadmin ${superadmin.email} generated impersonation token for Owner ${targetOwner.email}`
    );

    return {
      token,
      expiresIn: "2h",
      targetOwner: {
        id: targetOwner.id,
        name: targetOwner.name,
        email: targetOwner.email,
      },
      audit: {
        impersonatedBy: superadmin.email,
        timestamp: new Date(),
      },
    };
  }
}
