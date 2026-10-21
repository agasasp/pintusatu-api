import { Hono } from "hono";
import { WebhooksService } from "./webhooks.service.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import { authMiddleware, requireOwner } from "../../middlewares/auth.js";
import { db } from "../../config/db.js";
import { webhookLogs } from "../../db/schema.js";
import { desc } from "drizzle-orm";

export const webhookRoutes = new Hono();

// POST /api/webhooks/midtrans (Public callback endpoint from Midtrans)
webhookRoutes.post("/midtrans", async (c) => {
  try {
    const payload = await c.req.json();
    const result = await WebhooksService.handleMidtrans(payload);
    return c.json(result, 200);
  } catch (error: any) {
    console.error("Midtrans webhook error:", error);
    return c.json({ status: "Error", message: error.message }, 400);
  }
});

// POST /api/webhooks/xendit (Public callback endpoint from Xendit)
webhookRoutes.post("/xendit", async (c) => {
  try {
    const payload = await c.req.json();
    const callbackToken = c.req.header("x-callback-token");
    const result = await WebhooksService.handleXendit(payload, callbackToken);
    return c.json(result, 200);
  } catch (error: any) {
    console.error("Xendit webhook error:", error);
    return c.json({ status: "Error", message: error.message }, 400);
  }
});

// POST /api/webhooks/whatsapp (Public status callback from WhatsApp provider)
webhookRoutes.post("/whatsapp", async (c) => {
  try {
    const payload = await c.req.json();
    const result = await WebhooksService.handleWhatsApp(payload);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ status: "Error", message: error.message }, 400);
  }
});

// POST /api/webhooks/test-notification (Simulate WhatsApp message dispatch)
webhookRoutes.post("/test-notification", authMiddleware(), async (c) => {
  try {
    const body = await c.req.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return errorResponse(c, "Phone and message are required", 400);
    }

    const result = await WebhooksService.sendWhatsAppNotification(phone, message);
    return successResponse(c, result, "WhatsApp notification dispatched");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to dispatch notification", 400);
  }
});

// GET /api/webhooks/logs (View recent webhook logs - Owner & Superadmin)
webhookRoutes.get("/logs", authMiddleware(), requireOwner, async (c) => {
  try {
    const logs = await db
      .select()
      .from(webhookLogs)
      .orderBy(desc(webhookLogs.createdAt))
      .limit(50);

    return successResponse(c, logs, "Webhook logs retrieved");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve webhook logs", 400);
  }
});
