import { eq, and, sql, desc, gte, lte, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { financeTransactions, branches, users } from "../../db/schema.js";
import type {
  CreateTransactionInput,
  SubmitPettyCashInput,
  ApproveTransactionInput,
  QueryFinanceInput,
  NoiQueryInput,
} from "./finance.schema.js";
import type { AuthUser } from "../../middlewares/auth.js";
import { calculatePagination } from "../../utils/response.js";
import { getEffectiveOwnerId } from "../../middlewares/auth.js";

export class FinanceService {
  /**
   * Create finance transaction (General Income / Expense)
   */
  static async createTransaction(user: AuthUser, input: CreateTransactionInput) {
    const isOwner = user.role === "owner" || user.role === "superadmin";

    const [transaction] = await db
      .insert(financeTransactions)
      .values({
        branchId: input.branchId,
        userId: user.id,
        approvedBy: isOwner ? user.id : null,
        category: input.category,
        type: input.type,
        amount: input.amount.toString(),
        description: input.description,
        receiptUrl: input.receiptUrl || null,
        transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(),
        approvalStatus: isOwner ? "approved" : "pending",
      })
      .returning();

    return transaction;
  }

  /**
   * Submit petty cash claim (Staff on-ground submitting receipt for reimbursement)
   */
  static async submitPettyCash(user: AuthUser, input: SubmitPettyCashInput) {
    const [transaction] = await db
      .insert(financeTransactions)
      .values({
        branchId: input.branchId,
        userId: user.id,
        category: input.category,
        type: "expense",
        amount: input.amount.toString(),
        description: `[KAS KECIL] ${input.description}`,
        receiptUrl: input.receiptUrl,
        transactionDate: new Date(),
        approvalStatus: "pending",
      })
      .returning();

    return transaction;
  }

  /**
   * Owner approves or rejects petty cash / transaction
   */
  static async reviewTransaction(
    transactionId: string,
    user: AuthUser,
    input: ApproveTransactionInput
  ) {
    const [existing] = await db
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.id, transactionId))
      .limit(1);

    if (!existing) {
      throw new Error("Transaction not found");
    }

    if (existing.approvalStatus !== "pending") {
      throw new Error(`Transaction has already been ${existing.approvalStatus}`);
    }

    const [updated] = await db
      .update(financeTransactions)
      .set({
        approvalStatus: input.status,
        approvedBy: user.id,
        rejectionReason: input.status === "rejected" ? input.rejectionReason || "Rejected by owner" : null,
        updatedAt: new Date(),
      })
      .where(eq(financeTransactions.id, transactionId))
      .returning();

    return updated;
  }

  /**
   * List transactions with filters & pagination
   */
  static async listTransactions(query: QueryFinanceInput, user: AuthUser) {
    const conditions = [];

    if (query.branchId) conditions.push(eq(financeTransactions.branchId, query.branchId));
    if (query.type) conditions.push(eq(financeTransactions.type, query.type));
    if (query.approvalStatus) conditions.push(eq(financeTransactions.approvalStatus, query.approvalStatus));
    if (query.startDate) conditions.push(gte(financeTransactions.transactionDate, new Date(query.startDate)));
    if (query.endDate) conditions.push(lte(financeTransactions.transactionDate, new Date(query.endDate)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financeTransactions)
      .where(whereClause);

    const total = totalRes?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const items = await db.query.financeTransactions.findMany({
      where: whereClause,
      limit: query.limit,
      offset,
      orderBy: [desc(financeTransactions.transactionDate)],
      with: {
        branch: {
          columns: { id: true, name: true, city: true },
        },
        user: {
          columns: { id: true, name: true, role: true },
        },
        approver: {
          columns: { id: true, name: true, role: true },
        },
      },
    });

    const meta = calculatePagination(total, query.page, query.limit);
    return { items, meta };
  }

  /**
   * NOI (Net Operating Income) Calculation Engine
   * Calculates GOI, Operating Expenses, NOI, OER, and breakdown by categories
   */
  static async calculateNOI(user: AuthUser, query: NoiQueryInput) {
    const startDate = query.periodMonth
      ? new Date(query.periodYear, query.periodMonth - 1, 1)
      : new Date(query.periodYear, 0, 1);

    const endDate = query.periodMonth
      ? new Date(query.periodYear, query.periodMonth, 0, 23, 59, 59)
      : new Date(query.periodYear, 11, 31, 23, 59, 59);

    const conditions = [
      eq(financeTransactions.approvalStatus, "approved"),
      gte(financeTransactions.transactionDate, startDate),
      lte(financeTransactions.transactionDate, endDate),
    ];

    if (query.branchId) {
      conditions.push(eq(financeTransactions.branchId, query.branchId));
    }

    const transactions = await db
      .select()
      .from(financeTransactions)
      .where(and(...conditions));

    let grossOperatingIncome = 0;
    let operatingExpenses = 0;
    const categoryBreakdown: Record<string, { type: string; total: number; count: number }> = {};

    for (const trx of transactions) {
      const amount = Number(trx.amount);
      if (trx.type === "income") {
        grossOperatingIncome += amount;
      } else {
        operatingExpenses += amount;
      }

      if (!categoryBreakdown[trx.category]) {
        categoryBreakdown[trx.category] = {
          type: trx.type,
          total: 0,
          count: 0,
        };
      }
      categoryBreakdown[trx.category].total += amount;
      categoryBreakdown[trx.category].count += 1;
    }

    const netOperatingIncome = grossOperatingIncome - operatingExpenses;
    const operatingExpenseRatioPercent =
      grossOperatingIncome > 0
        ? Number(((operatingExpenses / grossOperatingIncome) * 100).toFixed(2))
        : 0;

    return {
      period: {
        year: query.periodYear,
        month: query.periodMonth || "Full Year",
        startDate,
        endDate,
      },
      branchId: query.branchId || "All Branches",
      grossOperatingIncome,
      totalOperatingExpenses: operatingExpenses,
      netOperatingIncome,
      operatingExpenseRatioPercent,
      transactionCount: transactions.length,
      categoryBreakdown,
    };
  }
}
