import { eq, and, sql, desc, inArray, lt } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  invoices,
  payments,
  leases,
  rooms,
  tenants,
  electricityReadings,
  financeTransactions,
  branches,
} from "../../db/schema.js";
import type {
  GenerateInvoiceInput,
  BatchGenerateInvoicesInput,
  RecordPaymentInput,
  VerifyPaymentInput,
  ApplyPenaltyInput,
  QueryInvoiceInput,
} from "./billing.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { calculatePagination } from "../../utils/response.js";

export class BillingService {
  /**
   * Helper to generate unique invoice number
   */
  private static generateInvoiceNumber(branchPrefix = "PNT"): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `INV/${dateStr}/${branchPrefix}-${randomHex}`;
  }

  /**
   * Generate an invoice for a single active lease
   */
  static async generateInvoice(input: GenerateInvoiceInput) {
    const [lease] = await db
      .select()
      .from(leases)
      .where(and(eq(leases.id, input.leaseId), eq(leases.status, "active")))
      .limit(1);

    if (!lease) {
      throw new Error("Active lease not found");
    }

    // Check unbilled electricity for this room
    let amountElectricity = 0;
    const unbilledReadings = await db
      .select()
      .from(electricityReadings)
      .where(
        and(
          eq(electricityReadings.roomId, lease.roomId),
          eq(electricityReadings.isBilled, false)
        )
      );

    if (input.includeUnbilledElectricity && unbilledReadings.length > 0) {
      amountElectricity = unbilledReadings.reduce(
        (sum, r) => sum + Number(r.totalAmount),
        0
      );

      // Mark these readings as billed
      const readingIds = unbilledReadings.map((r) => r.id);
      await db
        .update(electricityReadings)
        .set({ isBilled: true, leaseId: lease.id, updatedAt: new Date() })
        .where(inArray(electricityReadings.id, readingIds));
    }

    const amountRent = Number(lease.rentPrice);
    const amountOther = input.amountOther || 0;
    const totalAmount = amountRent + amountElectricity + amountOther;

    const invoiceNumber = this.generateInvoiceNumber();

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        leaseId: lease.id,
        tenantId: lease.tenantId,
        roomId: lease.roomId,
        branchId: lease.branchId,
        amountRent: amountRent.toString(),
        amountElectricity: amountElectricity.toString(),
        amountPenalty: "0.00",
        amountOther: amountOther.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: "0.00",
        remainingAmount: totalAmount.toString(),
        dueDate: new Date(input.dueDate),
        periodStart: input.periodStart ? new Date(input.periodStart) : null,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
        status: "unpaid",
        notes: input.notes || null,
      })
      .returning();

    return invoice;
  }

  /**
   * Batch generate monthly invoices for all active tenants in a branch
   */
  static async batchGenerateInvoices(input: BatchGenerateInvoicesInput) {
    const activeLeases = await db
      .select()
      .from(leases)
      .where(and(eq(leases.branchId, input.branchId), eq(leases.status, "active")));

    if (activeLeases.length === 0) {
      return { message: "No active leases found in this branch", createdCount: 0, invoices: [] };
    }

    const createdInvoices = [];

    const dueDate = new Date(input.billingYear, input.billingMonth - 1, input.dueDay);
    const periodStart = new Date(input.billingYear, input.billingMonth - 1, 1);
    const periodEnd = new Date(input.billingYear, input.billingMonth, 0); // Last day of month

    for (const lease of activeLeases) {
      // Check if an invoice for this lease and period already exists
      const existing = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.leaseId, lease.id),
            eq(invoices.periodStart, periodStart),
            eq(invoices.periodEnd, periodEnd)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue; // Skip already generated
      }

      // Check unbilled electricity
      let amountElectricity = 0;
      if (input.includeUnbilledElectricity) {
        const unbilled = await db
          .select()
          .from(electricityReadings)
          .where(
            and(
              eq(electricityReadings.roomId, lease.roomId),
              eq(electricityReadings.isBilled, false)
            )
          );

        if (unbilled.length > 0) {
          amountElectricity = unbilled.reduce((acc, r) => acc + Number(r.totalAmount), 0);
          await db
            .update(electricityReadings)
            .set({ isBilled: true, leaseId: lease.id, updatedAt: new Date() })
            .where(inArray(electricityReadings.id, unbilled.map((u) => u.id)));
        }
      }

      const amountRent = Number(lease.rentPrice);
      const totalAmount = amountRent + amountElectricity;

      const [inv] = await db
        .insert(invoices)
        .values({
          invoiceNumber: this.generateInvoiceNumber(),
          leaseId: lease.id,
          tenantId: lease.tenantId,
          roomId: lease.roomId,
          branchId: lease.branchId,
          amountRent: amountRent.toString(),
          amountElectricity: amountElectricity.toString(),
          amountPenalty: "0.00",
          amountOther: "0.00",
          totalAmount: totalAmount.toString(),
          paidAmount: "0.00",
          remainingAmount: totalAmount.toString(),
          dueDate,
          periodStart,
          periodEnd,
          status: "unpaid",
          notes: `Tagihan Sewa Bulan ${input.billingMonth}/${input.billingYear}`,
        })
        .returning();

      createdInvoices.push(inv);
    }

    return {
      message: `Batch generation completed: ${createdInvoices.length} invoices generated.`,
      createdCount: createdInvoices.length,
      invoices: createdInvoices,
    };
  }

  /**
   * Automated Penalty Engine:
   * Scan overdue invoices and apply configurable late penalties
   */
  static async processAutomatedPenalties(input: ApplyPenaltyInput) {
    const now = new Date();
    const conditions = [
      inArray(invoices.status, ["unpaid", "partially_paid", "overdue"]),
      lt(invoices.dueDate, now),
    ];

    if (input.branchId) {
      conditions.push(eq(invoices.branchId, input.branchId));
    }

    const overdueInvoices = await db
      .select()
      .from(invoices)
      .where(and(...conditions));

    const processed = [];

    for (const inv of overdueInvoices) {
      const daysLate = Math.max(
        1,
        Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      );

      let penalty = 0;
      if (input.penaltyType === "fixed_daily") {
        penalty = daysLate * input.fixedAmountPerDay;
      } else {
        penalty = (Number(inv.amountRent) * input.percentageRate) / 100;
      }

      const totalAmount =
        Number(inv.amountRent) +
        Number(inv.amountElectricity) +
        Number(inv.amountOther) +
        penalty;
      const remainingAmount = Math.max(0, totalAmount - Number(inv.paidAmount));

      const [updated] = await db
        .update(invoices)
        .set({
          status: "overdue",
          amountPenalty: penalty.toString(),
          totalAmount: totalAmount.toString(),
          remainingAmount: remainingAmount.toString(),
          penaltyAppliedAt: now,
          updatedAt: now,
        })
        .where(eq(invoices.id, inv.id))
        .returning();

      processed.push({
        invoiceNumber: inv.invoiceNumber,
        daysLate,
        penaltyAmount: penalty,
        newTotal: totalAmount,
      });
    }

    return {
      message: `Automated penalty processed for ${processed.length} invoices`,
      processedCount: processed.length,
      details: processed,
    };
  }

  /**
   * Record a payment
   */
  static async recordPayment(user: AuthUser, input: RecordPaymentInput) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, input.invoiceId))
      .limit(1);

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("Invoice is already fully paid");
    }

    if (invoice.status === "cancelled") {
      throw new Error("Cannot pay a cancelled invoice");
    }

    const paymentNumber = `PAY/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}/${Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase()}`;

    const isAutoApproved = input.autoApprove || user.role === "owner" || user.role === "superadmin";

    const [payment] = await db
      .insert(payments)
      .values({
        invoiceId: invoice.id,
        paymentNumber,
        amount: input.amount.toString(),
        paymentMethod: input.paymentMethod,
        proofUrl: input.proofUrl || null,
        status: isAutoApproved ? "approved" : "pending",
        verifiedBy: isAutoApproved ? user.id : null,
        verifiedAt: isAutoApproved ? new Date() : null,
        notes: input.notes || null,
      })
      .returning();

    // If auto-approved, update invoice balance and record finance income
    if (isAutoApproved) {
      await this.applyPaymentToInvoice(invoice, input.amount, user.id);
    }

    return payment;
  }

  /**
   * Verify / Approve a payment
   */
  static async verifyPayment(paymentId: string, user: AuthUser, input: VerifyPaymentInput) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new Error("Payment record not found");
    }

    if (payment.status !== "pending") {
      throw new Error(`Payment is already ${payment.status}`);
    }

    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: input.status,
        verifiedBy: user.id,
        verifiedAt: new Date(),
        notes: input.notes || payment.notes,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning();

    if (input.status === "approved") {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, payment.invoiceId))
        .limit(1);

      if (invoice) {
        await this.applyPaymentToInvoice(invoice, Number(payment.amount), user.id);
      }
    }

    return updatedPayment;
  }

  /**
   * Helper: apply approved payment amount to invoice and create finance transaction
   */
  private static async applyPaymentToInvoice(
    invoice: typeof invoices.$inferSelect,
    paidAddition: number,
    verifiedById: string
  ) {
    const currentPaid = Number(invoice.paidAmount);
    const totalAmount = Number(invoice.totalAmount);
    const newPaidAmount = currentPaid + paidAddition;
    const newRemainingAmount = Math.max(0, totalAmount - newPaidAmount);

    const newStatus =
      newRemainingAmount === 0 ? "paid" : newPaidAmount > 0 ? "partially_paid" : invoice.status;

    await db
      .update(invoices)
      .set({
        paidAmount: newPaidAmount.toString(),
        remainingAmount: newRemainingAmount.toString(),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    // Record cashflow finance income entry automatically!
    await db.insert(financeTransactions).values({
      branchId: invoice.branchId,
      userId: verifiedById,
      category: "rental_income",
      type: "income",
      amount: paidAddition.toString(),
      description: `Pembayaran tagihan ${invoice.invoiceNumber}`,
      approvalStatus: "approved",
    });
  }

  /**
   * List invoices with filters & pagination
   */
  static async listInvoices(query: QueryInvoiceInput) {
    const conditions = [];

    if (query.branchId) conditions.push(eq(invoices.branchId, query.branchId));
    if (query.tenantId) conditions.push(eq(invoices.tenantId, query.tenantId));
    if (query.status) conditions.push(eq(invoices.status, query.status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(whereClause);

    const total = totalRes?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const items = await db.query.invoices.findMany({
      where: whereClause,
      limit: query.limit,
      offset,
      orderBy: [desc(invoices.createdAt)],
      with: {
        tenant: {
          columns: { id: true, name: true, phone: true, email: true },
        },
        room: {
          columns: { id: true, roomNumber: true, type: true },
        },
        branch: {
          columns: { id: true, name: true, city: true },
        },
        payments: true,
      },
    });

    const meta = calculatePagination(total, query.page, query.limit);
    return { items, meta };
  }

  /**
   * Get invoice detail by ID
   */
  static async getInvoiceById(invoiceId: string) {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        tenant: true,
        room: true,
        branch: true,
        payments: {
          orderBy: [desc(payments.paidAt)],
          with: {
            verifier: {
              columns: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    return invoice;
  }
}
