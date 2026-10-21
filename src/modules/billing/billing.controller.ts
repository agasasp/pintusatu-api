import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { BillingService } from "./billing.service.js";
import {
  generateInvoiceSchema,
  batchGenerateInvoicesSchema,
  recordPaymentSchema,
  verifyPaymentSchema,
  applyPenaltySchema,
  queryInvoiceSchema,
} from "./billing.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  authMiddleware,
  requireOwner,
  requireStaffOrOwner,
} from "../../middlewares/auth.js";

export const billingRoutes = new Hono();

billingRoutes.use("*", authMiddleware());

// GET /api/billing/invoices (List invoices)
billingRoutes.get(
  "/invoices",
  requireStaffOrOwner,
  zValidator("query", queryInvoiceSchema),
  async (c) => {
    try {
      const query = c.req.valid("query");
      const result = await BillingService.listInvoices(query);
      return successResponse(
        c,
        result.items,
        "Invoices retrieved successfully",
        200,
        result.meta
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve invoices", 400);
    }
  }
);

// GET /api/billing/invoices/:id (Invoice detail)
billingRoutes.get("/invoices/:id", requireStaffOrOwner, async (c) => {
  try {
    const id = c.req.param("id");
    const invoice = await BillingService.getInvoiceById(id);
    return successResponse(c, invoice, "Invoice retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve invoice", 404);
  }
});

// POST /api/billing/invoices/generate (Single invoice)
billingRoutes.post(
  "/invoices/generate",
  requireStaffOrOwner,
  zValidator("json", generateInvoiceSchema),
  async (c) => {
    try {
      const input = c.req.valid("json");
      const invoice = await BillingService.generateInvoice(input);
      return successResponse(c, invoice, "Invoice generated successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to generate invoice", 400);
    }
  }
);

// POST /api/billing/invoices/batch (Batch generate for branch - Owner)
billingRoutes.post(
  "/invoices/batch",
  requireOwner,
  zValidator("json", batchGenerateInvoicesSchema),
  async (c) => {
    try {
      const input = c.req.valid("json");
      const result = await BillingService.batchGenerateInvoices(input);
      return successResponse(c, result, result.message, 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to batch generate invoices", 400);
    }
  }
);

// POST /api/billing/invoices/process-penalties (Run automated overdue penalties)
billingRoutes.post(
  "/invoices/process-penalties",
  requireOwner,
  zValidator("json", applyPenaltySchema),
  async (c) => {
    try {
      const input = c.req.valid("json");
      const result = await BillingService.processAutomatedPenalties(input);
      return successResponse(c, result, result.message);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to process penalties", 400);
    }
  }
);

// POST /api/billing/payments (Record payment)
billingRoutes.post(
  "/payments",
  requireStaffOrOwner,
  zValidator("json", recordPaymentSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const payment = await BillingService.recordPayment(user, input);
      return successResponse(c, payment, "Payment recorded successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to record payment", 400);
    }
  }
);

// PUT /api/billing/payments/:id/verify (Verify/Approve payment - Owner & Staff)
billingRoutes.put(
  "/payments/:id/verify",
  requireOwner,
  zValidator("json", verifyPaymentSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const payment = await BillingService.verifyPayment(id, user, input);
      return successResponse(c, payment, `Payment marked as ${input.status}`);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to verify payment", 400);
    }
  }
);
