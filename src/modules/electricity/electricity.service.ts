import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { electricityReadings, rooms, branches, leases } from "../../db/schema.js";
import type {
  RecordReadingInput,
  CalculatePreviewInput,
  QueryElectricityInput,
  ElectricitySummaryQueryInput,
} from "./electricity.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { calculatePagination } from "../../utils/response.js";

export class ElectricityService {
  /**
   * Helper to retrieve previous meter reading for a room
   */
  static async getRoomLastReading(roomId: string) {
    const lastReading = await db.query.electricityReadings.findFirst({
      where: and(
        eq(electricityReadings.roomId, roomId),
        eq(electricityReadings.mode, "meter")
      ),
      orderBy: [desc(electricityReadings.recordedAt)],
    });

    if (lastReading) {
      return {
        previousReading: Number(lastReading.currentReading),
        lastRecordedAt: lastReading.recordedAt,
        periodMonth: lastReading.periodMonth,
        periodYear: lastReading.periodYear,
      };
    }

    // Fall back to room's initial meter reading
    const [room] = await db
      .select({ meterInitial: rooms.meterInitial })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    return {
      previousReading: room ? Number(room.meterInitial) : 0,
      lastRecordedAt: null,
      periodMonth: null,
      periodYear: null,
    };
  }

  /**
   * Preview calculation for meter reading without persisting
   */
  static async previewCalculation(input: CalculatePreviewInput) {
    const [room] = await db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        branchId: rooms.branchId,
        meterInitial: rooms.meterInitial,
      })
      .from(rooms)
      .where(eq(rooms.id, input.roomId))
      .limit(1);

    if (!room) {
      throw new Error("Room not found");
    }

    const [branch] = await db
      .select({
        kwhRate: branches.kwhRate,
        kwhAdminFee: branches.kwhAdminFee,
      })
      .from(branches)
      .where(eq(branches.id, room.branchId))
      .limit(1);

    const last = await this.getRoomLastReading(room.id);
    const previous = last.previousReading;
    const current = input.currentReading;

    if (current < previous) {
      throw new Error(
        `Current meter reading (${current}) cannot be lower than previous reading (${previous})`
      );
    }

    const kwhUsed = Math.max(0, current - previous);
    const kwhRate = branch ? Number(branch.kwhRate) : 2000;
    const adminFee = branch ? Number(branch.kwhAdminFee) : 15000;
    const kwhCost = kwhUsed * kwhRate;
    const totalAmount = kwhCost + adminFee;

    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      previousReading: previous,
      currentReading: current,
      kwhUsed,
      kwhRate,
      kwhCost,
      adminFee,
      totalAmount,
    };
  }

  /**
   * 3-Mode Electricity Engine: Record electricity reading/cost
   */
  static async recordReading(user: AuthUser, input: RecordReadingInput) {
    // 1. Get Room and Branch
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, input.roomId))
      .limit(1);

    if (!room) {
      throw new Error("Room not found");
    }

    const [branch] = await db
      .select()
      .from(branches)
      .where(eq(branches.id, input.branchId))
      .limit(1);

    if (!branch) {
      throw new Error("Branch not found");
    }

    // 2. Find active lease for this room
    const [activeLease] = await db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.roomId, room.id), eq(leases.status, "active")))
      .limit(1);

    let previousReading = 0;
    let currentReading = 0;
    let kwhUsed = 0;
    let kwhRate = 0;
    let adminFee = 0;
    let totalAmount = 0;
    let tokenCode: string | null = null;

    // Mode-specific calculations
    if (input.mode === "meter") {
      if (input.currentReading === undefined) {
        throw new Error("Current reading is required for meter mode");
      }

      if (input.previousReading !== undefined) {
        previousReading = input.previousReading;
      } else {
        const last = await this.getRoomLastReading(room.id);
        previousReading = last.previousReading;
      }

      currentReading = input.currentReading;

      if (currentReading < previousReading) {
        throw new Error(
          `Current meter reading (${currentReading}) cannot be lower than previous reading (${previousReading})`
        );
      }

      kwhUsed = currentReading - previousReading;
      kwhRate = input.customKwhRate ?? Number(branch.kwhRate);
      adminFee = input.customAdminFee ?? Number(branch.kwhAdminFee);
      totalAmount = kwhUsed * kwhRate + adminFee;
    } else if (input.mode === "token") {
      if (!input.tokenCode) {
        throw new Error("Token code is required for token mode");
      }
      tokenCode = input.tokenCode;
      const tokenAmount = input.tokenAmount ?? 0;
      adminFee = input.customAdminFee ?? 2500; // Typical PLN token admin fee
      totalAmount = tokenAmount + adminFee;
    } else if (input.mode === "flat") {
      totalAmount = input.flatAmount ?? 100000; // Flat monthly rate
    }

    // 3. Save reading entry
    const [entry] = await db
      .insert(electricityReadings)
      .values({
        branchId: input.branchId,
        roomId: input.roomId,
        leaseId: activeLease?.id || null,
        recordedBy: user.id,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        mode: input.mode,
        previousReading: previousReading.toString(),
        currentReading: currentReading.toString(),
        kwhUsed: kwhUsed.toString(),
        kwhRate: kwhRate.toString(),
        adminFee: adminFee.toString(),
        totalAmount: totalAmount.toString(),
        tokenCode,
        meterPhotoUrl: input.meterPhotoUrl || null,
        isBilled: false,
      })
      .returning();

    return entry;
  }

  /**
   * List electricity reading records
   */
  static async listReadings(query: QueryElectricityInput, user: AuthUser) {
    const conditions = [];

    if (query.branchId) {
      conditions.push(eq(electricityReadings.branchId, query.branchId));
    }
    if (query.roomId) {
      conditions.push(eq(electricityReadings.roomId, query.roomId));
    }
    if (query.periodMonth) {
      conditions.push(eq(electricityReadings.periodMonth, query.periodMonth));
    }
    if (query.periodYear) {
      conditions.push(eq(electricityReadings.periodYear, query.periodYear));
    }
    if (query.mode) {
      conditions.push(eq(electricityReadings.mode, query.mode));
    }
    if (query.isBilled !== undefined) {
      conditions.push(eq(electricityReadings.isBilled, query.isBilled));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(electricityReadings)
      .where(whereClause);

    const total = totalRes?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const items = await db.query.electricityReadings.findMany({
      where: whereClause,
      limit: query.limit,
      offset,
      orderBy: [desc(electricityReadings.recordedAt)],
      with: {
        room: {
          columns: { id: true, roomNumber: true, type: true },
        },
        recorder: {
          columns: { id: true, name: true, role: true },
        },
      },
    });

    const meta = calculatePagination(total, query.page, query.limit);
    return { items, meta };
  }

  /**
   * Consumption summary for a branch in a given period
   */
  static async getBranchConsumptionSummary(input: ElectricitySummaryQueryInput) {
    const readings = await db
      .select()
      .from(electricityReadings)
      .where(
        and(
          eq(electricityReadings.branchId, input.branchId),
          eq(electricityReadings.periodMonth, input.periodMonth),
          eq(electricityReadings.periodYear, input.periodYear)
        )
      );

    const totalKwh = readings.reduce((acc, curr) => acc + Number(curr.kwhUsed), 0);
    const totalAmount = readings.reduce((acc, curr) => acc + Number(curr.totalAmount), 0);
    const billedCount = readings.filter((r) => r.isBilled).length;
    const unbilledCount = readings.filter((r) => !r.isBilled).length;

    return {
      branchId: input.branchId,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      recordedRoomsCount: readings.length,
      billedRoomsCount: billedCount,
      unbilledRoomsCount: unbilledCount,
      totalKwhUsed: Number(totalKwh.toFixed(2)),
      totalElectricityAmount: totalAmount,
    };
  }
}
