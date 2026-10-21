import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { requestLogger } from "./middlewares/logger.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { successResponse } from "./utils/response.js";

// Module routes
import { authRoutes } from "./modules/auth/index.js";
import { branchRoutes } from "./modules/branches/index.js";
import { roomRoutes } from "./modules/rooms/index.js";
import { tenantRoutes } from "./modules/tenants/index.js";
import { electricityRoutes } from "./modules/electricity/index.js";
import { billingRoutes } from "./modules/billing/index.js";
import { taskRoutes } from "./modules/tasks/index.js";
import { financeRoutes } from "./modules/finance/index.js";
import { webhookRoutes } from "./modules/webhooks/index.js";
import { superadminRoutes } from "./modules/superadmin/index.js";

const app = new Hono();

// ==========================================
// GLOBAL MIDDLEWARES
// ==========================================
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow configured origins or reflect localhost in development
      if (!origin || env.CORS_ORIGINS.includes(origin) || origin.startsWith("http://localhost:")) {
        return origin || "*";
      }
      return env.CORS_ORIGINS[0];
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-callback-token"],
    credentials: true,
  })
);

app.use("*", requestLogger());

// Global Error Handler
app.onError(errorHandler);

// ==========================================
// BASE & HEALTHCHECK ROUTES
// ==========================================
app.get("/", (c) => {
  return c.json({
    service: "PintuSatu API",
    tagline: "SaaS Platform Manajemen Kost Modern Indonesia",
    version: "1.0.0",
    docs: "/api",
    health: "/api/health",
  });
});

app.get("/api", (c) => {
  return successResponse(c, {
    service: "PintuSatu REST API",
    version: "1.0.0",
    status: "operational",
    endpoints: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        me: "GET /api/auth/me",
        profile: "PUT /api/auth/profile",
        password: "PUT /api/auth/password",
        staff: "POST|GET /api/auth/staff",
      },
      branches: {
        list: "GET /api/branches",
        detail: "GET /api/branches/:id",
        stats: "GET /api/branches/:id/stats",
        create: "POST /api/branches",
        update: "PUT /api/branches/:id",
        delete: "DELETE /api/branches/:id",
        assignStaff: "POST /api/branches/:id/staff",
      },
      rooms: {
        list: "GET /api/rooms",
        detail: "GET /api/rooms/:id",
        create: "POST /api/rooms",
        update: "PUT /api/rooms/:id",
        status: "PATCH /api/rooms/:id/status",
        delete: "DELETE /api/rooms/:id",
      },
      tenants: {
        list: "GET /api/tenants",
        detail: "GET /api/tenants/:id",
        create: "POST /api/tenants",
        update: "PUT /api/tenants/:id",
        checkIn: "POST /api/tenants/check-in",
        checkOut: "POST /api/tenants/check-out",
      },
      electricity: {
        record: "POST /api/electricity/record",
        preview: "POST /api/electricity/preview",
        lastReading: "GET /api/electricity/last/:roomId",
        readings: "GET /api/electricity/readings",
        summary: "GET /api/electricity/summary",
      },
      billing: {
        invoices: "GET /api/billing/invoices",
        invoiceDetail: "GET /api/billing/invoices/:id",
        generateSingle: "POST /api/billing/invoices/generate",
        batchGenerate: "POST /api/billing/invoices/batch",
        processPenalties: "POST /api/billing/invoices/process-penalties",
        recordPayment: "POST /api/billing/payments",
        verifyPayment: "PUT /api/billing/payments/:id/verify",
      },
      tasks: {
        list: "GET /api/tasks",
        detail: "GET /api/tasks/:id",
        create: "POST /api/tasks",
        update: "PUT /api/tasks/:id",
        complete: "POST /api/tasks/:id/complete",
        verify: "POST /api/tasks/:id/verify",
      },
      finance: {
        transactions: "GET /api/finance/transactions",
        recordTransaction: "POST /api/finance/transactions",
        submitPettyCash: "POST /api/finance/petty-cash",
        reviewTransaction: "PUT /api/finance/transactions/:id/review",
        noi: "GET /api/finance/noi",
      },
      webhooks: {
        midtrans: "POST /api/webhooks/midtrans",
        xendit: "POST /api/webhooks/xendit",
        whatsapp: "POST /api/webhooks/whatsapp",
        testNotification: "POST /api/webhooks/test-notification",
        logs: "GET /api/webhooks/logs",
      },
      superadmin: {
        metrics: "GET /api/superadmin/metrics",
        owners: "GET /api/superadmin/owners",
        suspend: "POST /api/superadmin/owners/:id/suspend",
        reactivate: "POST /api/superadmin/owners/:id/reactivate",
        subscription: "PUT /api/superadmin/owners/:id/subscription",
        impersonate: "POST /api/superadmin/impersonate",
      },
    },
  });
});

app.get("/api/health", (c) => {
  return successResponse(c, {
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ==========================================
// MOUNT MODULE ROUTERS
// ==========================================
app.route("/api/auth", authRoutes);
app.route("/api/branches", branchRoutes);
app.route("/api/rooms", roomRoutes);
app.route("/api/tenants", tenantRoutes);
app.route("/api/electricity", electricityRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/finance", financeRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/superadmin", superadminRoutes);

// 404 Route Handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      statusCode: 404,
      message: `Endpoint ${c.req.method} ${c.req.path} not found on PintuSatu API`,
    },
    404
  );
});

// ==========================================
// START SERVER
// ==========================================
if (process.env.NODE_ENV !== "test") {
  serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      console.log(`
🚀 ====================================================
🚪 PintuSatu Kost Management SaaS REST API Started!
📡 URL: http://localhost:${info.port}
📚 Docs Index: http://localhost:${info.port}/api
❤️  Health Check: http://localhost:${info.port}/api/health
🌐 Allowed CORS: ${env.CORS_ORIGINS.join(", ")}
====================================================
      `);
    }
  );
}

export default app;
