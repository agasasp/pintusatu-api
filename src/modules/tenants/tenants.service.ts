import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  tenants,
  leases,
  rooms,
  branches,
  invoices,
  tasks,
  financeTransactions,
} from "../../db/schema.js";
import type {
  CreateTenantInput,
  UpdateTenantInput,
  CheckInInput,
  CheckOutInput,
  QueryTenantInput,
} from "./tenants.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { calculatePagination } from "../../utils/response.js";
import { getEffectiveOwnerId } from "../../middlewares/auth.js";

export class TenantsService {
  /**
   * Create a new tenant record
   */
  static async createTenant(user: AuthUser, input: CreateTenantInput) {
    const ownerId = getEffectiveOwnerId(user);

    const [tenant] = await db
      .insert(tenants)
      .values({
        ownerId,
        name: input.name,
        email: input.email ? input.email.toLowerCase() : null,
        phone: input.phone,
        identityType: input.identityType,
        identityNumber: input.identityNumber,
        identityPhotoUrl: input.identityPhotoUrl || null,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactPhone: input.emergencyContactPhone || null,
        emergencyContactRelation: input.emergencyContactRelation || null,
        occupation: input.occupation || null,
        status: "active",
      })
      .returning();

    return tenant;
  }

  /**
   * List tenants with search and pagination
   */
  static async listTenants(query: QueryTenantInput, user: AuthUser) {
    const ownerId = getEffectiveOwnerId(user);
    const conditions = [eq(tenants.ownerId, ownerId)];

    if (query.status) {
      conditions.push(eq(tenants.status, query.status));
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(tenants.name, searchPattern),
          ilike(tenants.phone, searchPattern),
          ilike(tenants.identityNumber, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(whereClause);

    const total = totalRes?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const tenantList = await db.query.tenants.findMany({
      where: whereClause,
      limit: query.limit,
      offset,
      orderBy: [desc(tenants.createdAt)],
      with: {
        leases: {
          where: eq(leases.status, "active"),
          with: {
            room: {
              columns: { id: true, roomNumber: true, type: true },
              with: {
                branch: {
                  columns: { id: true, name: true, city: true },
                },
              },
            },
          },
        },
      },
    });

    const items = tenantList.map((t) => ({
      ...t,
      currentOccupancy: t.leases[0] || null,
    }));

    const meta = calculatePagination(total, query.page, query.limit);
    return { items, meta };
  }

  /**
   * Get single tenant details
   */
  static async getTenantById(tenantId: string, user: AuthUser) {
    const ownerId = getEffectiveOwnerId(user);

    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.id, tenantId), eq(tenants.ownerId, ownerId)),
      with: {
        leases: {
          orderBy: [desc(leases.createdAt)],
          with: {
            room: {
              with: {
                branch: true,
              },
            },
          },
        },
        invoices: {
          orderBy: [desc(invoices.createdAt)],
          limit: 10,
        },
      },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    return tenant;
  }

  /**
   * Update tenant profile
   */
  static async updateTenant(tenantId: string, user: AuthUser, input: UpdateTenantInput) {
    const ownerId = getEffectiveOwnerId(user);

    const [updated] = await db
      .update(tenants)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.email !== undefined && { email: input.email ? input.email.toLowerCase() : null }),
        ...(input.phone && { phone: input.phone }),
        ...(input.identityType && { identityType: input.identityType }),
        ...(input.identityNumber && { identityNumber: input.identityNumber }),
        ...(input.identityPhotoUrl !== undefined && { identityPhotoUrl: input.identityPhotoUrl }),
        ...(input.emergencyContactName !== undefined && { emergencyContactName: input.emergencyContactName }),
        ...(input.emergencyContactPhone !== undefined && { emergencyContactPhone: input.emergencyContactPhone }),
        ...(input.emergencyContactRelation !== undefined && { emergencyContactRelation: input.emergencyContactRelation }),
        ...(input.occupation !== undefined && { occupation: input.occupation }),
        ...(input.status && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(and(eq(tenants.id, tenantId), eq(tenants.ownerId, ownerId)))
      .returning();

    if (!updated) {
      throw new Error("Tenant not found or access denied");
    }

    return updated;
  }

  /**
   * Check-in tenant to a room:
   * 1. Validates room availability
   * 2. Creates Lease
   * 3. Updates room to 'occupied'
   * 4. Generates initial invoice (Rent + Deposit)
   */
  static async checkIn(user: AuthUser, input: CheckInInput) {
    const ownerId = getEffectiveOwnerId(user);

    // 1. Verify tenant belongs to owner
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, input.tenantId), eq(tenants.ownerId, ownerId)))
      .limit(1);

    if (!tenant) {
      throw new Error("Tenant not found or access denied");
    }

    // 2. Verify room and get branch
    const [room] = await db
      .select({
        id: rooms.id,
        status: rooms.status,
        branchId: rooms.branchId,
        roomNumber: rooms.roomNumber,
      })
      .from(rooms)
      .where(eq(rooms.id, input.roomId))
      .limit(1);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status === "occupied") {
      throw new Error(`Room ${room.roomNumber} is currently occupied`);
    }

    const startDate = new Date(input.startDate);
    const endDate = input.endDate ? new Date(input.endDate) : null;

    // 3. Create active lease
    const [lease] = await db
      .insert(leases)
      .values({
        roomId: room.id,
        tenantId: tenant.id,
        branchId: room.branchId,
        startDate,
        endDate,
        rentPrice: input.rentPrice.toString(),
        depositPaid: input.depositPaid.toString(),
        billingCycleDay: input.billingCycleDay,
        paymentTerm: input.paymentTerm,
        electricityBillingModeOverride: input.electricityBillingModeOverride,
        status: "active",
      })
      .returning();

    // 4. Update room status to occupied
    await db
      .update(rooms)
      .set({
        status: "occupied",
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, room.id));

    let initialInvoice = null;

    // 5. Generate initial invoice if requested
    if (input.generateInitialInvoice) {
      const invoiceNumber = `INV/${new Date().getFullYear()}${String(
        new Date().getMonth() + 1
      ).padStart(2, "0")}/${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const totalAmount = input.rentPrice + input.depositPaid;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // 3 days payment window

      const [inv] = await db
        .insert(invoices)
        .values({
          invoiceNumber,
          leaseId: lease.id,
          tenantId: tenant.id,
          roomId: room.id,
          branchId: room.branchId,
          amountRent: input.rentPrice.toString(),
          amountOther: input.depositPaid.toString(), // Deposit listed as other item
          amountElectricity: "0.00",
          amountPenalty: "0.00",
          totalAmount: totalAmount.toString(),
          paidAmount: "0.00",
          remainingAmount: totalAmount.toString(),
          dueDate,
          periodStart: startDate,
          periodEnd: endDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: "unpaid",
          notes: "Initial check-in invoice (First month rent + Security deposit)",
        })
        .returning();

      initialInvoice = inv;
    }

    return {
      lease,
      roomNumber: room.roomNumber,
      tenantName: tenant.name,
      initialInvoice,
    };
  }

  /**
   * Check-out tenant from a room:
   * 1. Terminate lease
   * 2. Set room to next status ('maintenance' or 'available')
   * 3. Optionally create cleaning/inspection task
   * 4. Handle deposit deductions / refund log
   */
  static async checkOut(user: AuthUser, input: CheckOutInput) {
    const ownerId = getEffectiveOwnerId(user);

    // 1. Get active lease
    const [lease] = await db
      .select({
        id: leases.id,
        roomId: leases.roomId,
        branchId: leases.branchId,
        tenantId: leases.tenantId,
        status: leases.status,
      })
      .from(leases)
      .where(and(eq(leases.id, input.leaseId), eq(leases.status, "active")))
      .limit(1);

    if (!lease) {
      throw new Error("Active lease not found");
    }

    const checkOutDate = input.checkOutDate ? new Date(input.checkOutDate) : new Date();

    // 2. Terminate lease
    const [updatedLease] = await db
      .update(leases)
      .set({
        status: "terminated",
        endDate: checkOutDate,
        updatedAt: new Date(),
      })
      .where(eq(leases.id, lease.id))
      .returning();

    // 3. Update room status
    await db
      .update(rooms)
      .set({
        status: input.roomNextStatus,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, lease.roomId));

    // 4. Create cleaning task for penjaga
    let cleaningTask = null;
    if (input.createCleaningTask) {
      const [room] = await db
        .select({ roomNumber: rooms.roomNumber })
        .from(rooms)
        .where(eq(rooms.id, lease.roomId));

      const [task] = await db
        .insert(tasks)
        .values({
          branchId: lease.branchId,
          roomId: lease.roomId,
          createdBy: user.id,
          title: `Pembersihan & Inspeksi Pasca Check-Out Kamar ${room?.roomNumber || ""}`,
          description: `Kamar telah di-checkout pada ${checkOutDate.toISOString().split("T")[0]}. Silakan lakukan pembersihan menyeluruh, pengecekan inventaris kasur, AC, dan kamar mandi.`,
          taskType: "housekeeping",
          priority: "high",
          status: "todo",
          cost: "0.00",
        })
        .returning();

      cleaningTask = task;
    }

    // 5. If deposit deduction occurred, record finance transaction
    if (input.deductionsAmount > 0) {
      await db.insert(financeTransactions).values({
        branchId: lease.branchId,
        userId: user.id,
        category: "deposit_income",
        type: "income",
        amount: input.deductionsAmount.toString(),
        description: `Potongan deposit check-out lease ${lease.id}: ${input.deductionsReason || "Biaya perbaikan/kerusakan"}`,
        approvalStatus: "approved",
      });
    }

    return {
      message: "Check-out completed successfully",
      lease: updatedLease,
      cleaningTask,
      depositRefundAmount: input.depositRefundAmount,
      deductionsAmount: input.deductionsAmount,
    };
  }
}
