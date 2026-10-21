import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SuperadminService } from "./superadmin.service.js";
import {
  suspendOwnerSchema,
  updateSubscriptionSchema,
  impersonateSchema,
} from "./superadmin.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import { authMiddleware, requireSuperadmin } from "../../middlewares/auth.js";

export const superadminRoutes = new Hono();

superadminRoutes.use("*", authMiddleware(), requireSuperadmin);

// GET /api/superadmin/metrics (MRR and Platform Statistics)
superadminRoutes.get("/metrics", async (c) => {
  try {
    const metrics = await SuperadminService.getPlatformMetrics();
    return successResponse(c, metrics, "Platform metrics retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve metrics", 400);
  }
});

// GET /api/superadmin/owners (List all owners & properties)
superadminRoutes.get("/owners", async (c) => {
  try {
    const owners = await SuperadminService.listOwners();
    return successResponse(c, owners, "Owners list retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve owners", 400);
  }
});

// POST /api/superadmin/owners/:id/suspend (Suspend owner account & properties)
superadminRoutes.post(
  "/owners/:id/suspend",
  zValidator("json", suspendOwnerSchema),
  async (c) => {
    try {
      const ownerId = c.req.param("id");
      const input = c.req.valid("json");
      const result = await SuperadminService.suspendOwner(ownerId, input);
      return successResponse(c, result, result.message);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to suspend owner", 400);
    }
  }
);

// POST /api/superadmin/owners/:id/reactivate (Reactivate suspended owner)
superadminRoutes.post("/owners/:id/reactivate", async (c) => {
  try {
    const ownerId = c.req.param("id");
    const result = await SuperadminService.reactivateOwner(ownerId);
    return successResponse(c, result, result.message);
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to reactivate owner", 400);
  }
});

// PUT /api/superadmin/owners/:id/subscription (Upgrade/Downgrade quota & tier)
superadminRoutes.put(
  "/owners/:id/subscription",
  zValidator("json", updateSubscriptionSchema),
  async (c) => {
    try {
      const ownerId = c.req.param("id");
      const input = c.req.valid("json");
      const result = await SuperadminService.updateSubscription(ownerId, input);
      return successResponse(c, result, "Subscription updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update subscription", 400);
    }
  }
);

// POST /api/superadmin/impersonate (Generate impersonation token for troubleshooting)
superadminRoutes.post(
  "/impersonate",
  zValidator("json", impersonateSchema),
  async (c) => {
    try {
      const superadmin = c.get("user");
      const { ownerId } = c.req.valid("json");
      const result = await SuperadminService.generateImpersonationToken(superadmin, ownerId);
      return successResponse(c, result, "Impersonation token generated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to generate impersonation token", 400);
    }
  }
);
