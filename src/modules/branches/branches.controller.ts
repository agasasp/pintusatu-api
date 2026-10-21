import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { BranchesService } from "./branches.service.js";
import {
  createBranchSchema,
  updateBranchSchema,
  assignStaffSchema,
} from "./branches.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  authMiddleware,
  requireOwner,
  requireStaffOrOwner,
} from "../../middlewares/auth.js";

export const branchRoutes = new Hono();

branchRoutes.use("*", authMiddleware());

// GET /api/branches (List accessible branches)
branchRoutes.get("/", requireStaffOrOwner, async (c) => {
  try {
    const user = c.get("user");
    const branchesList = await BranchesService.listBranches(user);
    return successResponse(c, branchesList, "Branches retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve branches", 400);
  }
});

// GET /api/branches/:id (Branch detail)
branchRoutes.get("/:id", requireStaffOrOwner, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const branch = await BranchesService.getBranchById(id, user);
    return successResponse(c, branch, "Branch retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve branch", 404);
  }
});

// GET /api/branches/:id/stats (Occupancy & revenue statistics)
branchRoutes.get("/:id/stats", requireStaffOrOwner, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const stats = await BranchesService.getBranchStats(id, user);
    return successResponse(c, stats, "Branch statistics retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve branch statistics", 400);
  }
});

// POST /api/branches (Create branch - Owner only)
branchRoutes.post(
  "/",
  requireOwner,
  zValidator("json", createBranchSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const branch = await BranchesService.createBranch(user.id, input);
      return successResponse(c, branch, "Branch created successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to create branch", 400);
    }
  }
);

// PUT /api/branches/:id (Update branch - Owner only)
branchRoutes.put(
  "/:id",
  requireOwner,
  zValidator("json", updateBranchSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await BranchesService.updateBranch(id, user.id, input);
      return successResponse(c, updated, "Branch updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update branch", 400);
    }
  }
);

// DELETE /api/branches/:id (Delete branch - Owner only)
branchRoutes.delete("/:id", requireOwner, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await BranchesService.deleteBranch(id, user.id);
    return successResponse(c, result, "Branch deleted successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to delete branch", 400);
  }
});

// POST /api/branches/:id/staff (Assign staff to branch)
branchRoutes.post(
  "/:id/staff",
  requireOwner,
  zValidator("json", assignStaffSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const { staffId } = c.req.valid("json");
      const result = await BranchesService.assignStaff(id, staffId, user.id);
      return successResponse(c, result, "Staff assigned to branch successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to assign staff", 400);
    }
  }
);

// DELETE /api/branches/:id/staff/:staffId (Unassign staff from branch)
branchRoutes.delete("/:id/staff/:staffId", requireOwner, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const staffId = c.req.param("staffId");
    const result = await BranchesService.removeStaff(id, staffId, user.id);
    return successResponse(c, result, "Staff unassigned from branch successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to unassign staff", 400);
  }
});
