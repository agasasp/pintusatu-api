import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ElectricityService } from "./electricity.service.js";
import {
  recordReadingSchema,
  calculatePreviewSchema,
  queryElectricitySchema,
  electricitySummaryQuerySchema,
} from "./electricity.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import { authMiddleware, requireStaffOrOwner } from "../../middlewares/auth.js";

export const electricityRoutes = new Hono();

electricityRoutes.use("*", authMiddleware());

// POST /api/electricity/record (Record reading - Staff/Owner)
electricityRoutes.post(
  "/record",
  requireStaffOrOwner,
  zValidator("json", recordReadingSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const result = await ElectricityService.recordReading(user, input);
      return successResponse(c, result, "Electricity reading recorded successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to record electricity reading", 400);
    }
  }
);

// POST /api/electricity/preview (Calculate preview before saving)
electricityRoutes.post(
  "/preview",
  requireStaffOrOwner,
  zValidator("json", calculatePreviewSchema),
  async (c) => {
    try {
      const input = c.req.valid("json");
      const result = await ElectricityService.previewCalculation(input);
      return successResponse(c, result, "Preview calculation completed");
    } catch (error: any) {
      return errorResponse(c, error.message || "Preview calculation failed", 400);
    }
  }
);

// GET /api/electricity/last/:roomId (Get last recorded reading)
electricityRoutes.get("/last/:roomId", requireStaffOrOwner, async (c) => {
  try {
    const roomId = c.req.param("roomId");
    const result = await ElectricityService.getRoomLastReading(roomId);
    return successResponse(c, result, "Last meter reading retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to get last reading", 400);
  }
});

// GET /api/electricity/readings (List reading records)
electricityRoutes.get(
  "/readings",
  requireStaffOrOwner,
  zValidator("query", queryElectricitySchema),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await ElectricityService.listReadings(query, user);
      return successResponse(
        c,
        result.items,
        "Electricity readings retrieved successfully",
        200,
        result.meta
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve readings", 400);
    }
  }
);

// GET /api/electricity/summary (Get branch monthly consumption summary)
electricityRoutes.get(
  "/summary",
  requireStaffOrOwner,
  zValidator("query", electricitySummaryQuerySchema),
  async (c) => {
    try {
      const query = c.req.valid("query");
      const result = await ElectricityService.getBranchConsumptionSummary(query);
      return successResponse(c, result, "Consumption summary retrieved successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve summary", 400);
    }
  }
);
