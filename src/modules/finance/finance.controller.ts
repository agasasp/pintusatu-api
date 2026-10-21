import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { FinanceService } from "./finance.service.js";
import {
  createTransactionSchema,
  submitPettyCashSchema,
  approveTransactionSchema,
  queryFinanceSchema,
  noiQuerySchema,
} from "./finance.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  authMiddleware,
  requireOwner,
  requireStaffOrOwner,
} from "../../middlewares/auth.js";

export const financeRoutes = new Hono();

financeRoutes.use("*", authMiddleware());

// GET /api/finance/transactions (List income, expenses & petty cash)
financeRoutes.get(
  "/transactions",
  requireStaffOrOwner,
  zValidator("query", queryFinanceSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await FinanceService.listTransactions(query, user);
      return successResponse(
        c,
        result.items,
        "Finance transactions retrieved successfully",
        200,
        result.meta
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve transactions", 400);
    }
  }
);

// POST /api/finance/transactions (Create income or expense - Owner)
financeRoutes.post(
  "/transactions",
  requireOwner,
  zValidator("json", createTransactionSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const transaction = await FinanceService.createTransaction(user, input);
      return successResponse(c, transaction, "Transaction recorded successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to record transaction", 400);
    }
  }
);

// POST /api/finance/petty-cash (Submit petty cash claim with receipt - Staff & Owner)
financeRoutes.post(
  "/petty-cash",
  requireStaffOrOwner,
  zValidator("json", submitPettyCashSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const transaction = await FinanceService.submitPettyCash(user, input);
      return successResponse(
        c,
        transaction,
        "Petty cash claim submitted for owner approval",
        201
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to submit petty cash claim", 400);
    }
  }
);

// PUT /api/finance/transactions/:id/review (Approve or Reject petty cash - Owner only)
financeRoutes.put(
  "/transactions/:id/review",
  requireOwner,
  zValidator("json", approveTransactionSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const result = await FinanceService.reviewTransaction(id, user, input);
      return successResponse(c, result, `Transaction marked as ${input.status}`);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to review transaction", 400);
    }
  }
);

// GET /api/finance/noi (Calculate Net Operating Income - Owner only)
financeRoutes.get(
  "/noi",
  requireOwner,
  zValidator("query", noiQuerySchema),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await FinanceService.calculateNOI(user, query);
      return successResponse(c, result, "NOI calculated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to calculate NOI", 400);
    }
  }
);
