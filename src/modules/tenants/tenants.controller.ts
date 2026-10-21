import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { TenantsService } from "./tenants.service.js";
import {
  createTenantSchema,
  updateTenantSchema,
  checkInSchema,
  checkOutSchema,
  queryTenantSchema,
} from "./tenants.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import { authMiddleware, requireStaffOrOwner } from "../../middlewares/auth.js";

export const tenantRoutes = new Hono();

tenantRoutes.use("*", authMiddleware());

// GET /api/tenants (List tenants)
tenantRoutes.get(
  "/",
  requireStaffOrOwner,
  zValidator("query", queryTenantSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await TenantsService.listTenants(query, user);
      return successResponse(
        c,
        result.items,
        "Tenants retrieved successfully",
        200,
        result.meta
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve tenants", 400);
    }
  }
);

// GET /api/tenants/:id (Tenant detail)
tenantRoutes.get("/:id", requireStaffOrOwner, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const tenant = await TenantsService.getTenantById(id, user);
    return successResponse(c, tenant, "Tenant details retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve tenant", 404);
  }
});

// POST /api/tenants (Create tenant profile)
tenantRoutes.post(
  "/",
  requireStaffOrOwner,
  zValidator("json", createTenantSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const tenant = await TenantsService.createTenant(user, input);
      return successResponse(c, tenant, "Tenant profile created successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to create tenant", 400);
    }
  }
);

// PUT /api/tenants/:id (Update tenant profile)
tenantRoutes.put(
  "/:id",
  requireStaffOrOwner,
  zValidator("json", updateTenantSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await TenantsService.updateTenant(id, user, input);
      return successResponse(c, updated, "Tenant updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update tenant", 400);
    }
  }
);

// POST /api/tenants/check-in (Check in tenant to room)
tenantRoutes.post(
  "/check-in",
  requireStaffOrOwner,
  zValidator("json", checkInSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const result = await TenantsService.checkIn(user, input);
      return successResponse(c, result, "Tenant checked in successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to check-in tenant", 400);
    }
  }
);

// POST /api/tenants/check-out (Check out tenant from room)
tenantRoutes.post(
  "/check-out",
  requireStaffOrOwner,
  zValidator("json", checkOutSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const result = await TenantsService.checkOut(user, input);
      return successResponse(c, result, "Tenant checked out successfully", 200);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to check out tenant", 400);
    }
  }
);
