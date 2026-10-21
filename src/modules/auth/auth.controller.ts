import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { AuthService } from "./auth.service.js";
import {
  registerSchema,
  loginSchema,
  createStaffSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "./auth.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import { authMiddleware, requireOwner } from "../../middlewares/auth.js";

export const authRoutes = new Hono();

// POST /api/auth/register
authRoutes.post("/register", zValidator("json", registerSchema), async (c) => {
  try {
    const input = c.req.valid("json");
    const result = await AuthService.registerOwner(input);
    return successResponse(c, result, "Owner registered successfully", 201);
  } catch (error: any) {
    return errorResponse(c, error.message || "Registration failed", 400);
  }
});

// POST /api/auth/login
authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  try {
    const input = c.req.valid("json");
    const result = await AuthService.login(input);
    return successResponse(c, result, "Login successful", 200);
  } catch (error: any) {
    return errorResponse(c, error.message || "Login failed", 401);
  }
});

// GET /api/auth/me
authRoutes.get("/me", authMiddleware(), async (c) => {
  try {
    const currentUser = c.get("user");
    const profile = await AuthService.getProfile(currentUser.id);
    return successResponse(c, profile, "Profile fetched successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to fetch profile", 400);
  }
});

// PUT /api/auth/profile
authRoutes.put(
  "/profile",
  authMiddleware(),
  zValidator("json", updateProfileSchema),
  async (c) => {
    try {
      const currentUser = c.get("user");
      const input = c.req.valid("json");
      const updated = await AuthService.updateProfile(currentUser.id, input);
      return successResponse(c, updated, "Profile updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update profile", 400);
    }
  }
);

// PUT /api/auth/password
authRoutes.put(
  "/password",
  authMiddleware(),
  zValidator("json", changePasswordSchema),
  async (c) => {
    try {
      const currentUser = c.get("user");
      const input = c.req.valid("json");
      const result = await AuthService.changePassword(currentUser.id, input);
      return successResponse(c, result, "Password updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to change password", 400);
    }
  }
);

// POST /api/auth/staff (Owner creates staff / penjaga)
authRoutes.post(
  "/staff",
  authMiddleware(),
  requireOwner,
  zValidator("json", createStaffSchema),
  async (c) => {
    try {
      const currentUser = c.get("user");
      const input = c.req.valid("json");
      const staff = await AuthService.createStaff(currentUser.id, input);
      return successResponse(c, staff, "Staff member created successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to create staff", 400);
    }
  }
);

// GET /api/auth/staff (Owner lists their staff members)
authRoutes.get("/staff", authMiddleware(), requireOwner, async (c) => {
  try {
    const currentUser = c.get("user");
    const staffList = await AuthService.listStaff(currentUser.id);
    return successResponse(c, staffList, "Staff list fetched successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to fetch staff list", 400);
  }
});
