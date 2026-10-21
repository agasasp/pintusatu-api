import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { RoomsService } from "./rooms.service.js";
import {
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
  queryRoomSchema,
} from "./rooms.schema.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  authMiddleware,
  requireOwner,
  requireStaffOrOwner,
} from "../../middlewares/auth.js";

export const roomRoutes = new Hono();

roomRoutes.use("*", authMiddleware());

// GET /api/rooms (List rooms with filters)
roomRoutes.get(
  "/",
  requireStaffOrOwner,
  zValidator("query", queryRoomSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await RoomsService.listRooms(query, user);
      return successResponse(
        c,
        result.items,
        "Rooms retrieved successfully",
        200,
        result.meta
      );
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to retrieve rooms", 400);
    }
  }
);

// GET /api/rooms/:id (Room detail)
roomRoutes.get("/:id", requireStaffOrOwner, async (c) => {
  try {
    const id = c.req.param("id");
    const room = await RoomsService.getRoomById(id);
    return successResponse(c, room, "Room details retrieved successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to retrieve room", 404);
  }
});

// POST /api/rooms (Create room)
roomRoutes.post(
  "/",
  requireOwner,
  zValidator("json", createRoomSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const input = c.req.valid("json");
      const room = await RoomsService.createRoom(user, input);
      return successResponse(c, room, "Room created successfully", 201);
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to create room", 400);
    }
  }
);

// PUT /api/rooms/:id (Update room)
roomRoutes.put(
  "/:id",
  requireOwner,
  zValidator("json", updateRoomSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await RoomsService.updateRoom(id, input);
      return successResponse(c, updated, "Room updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update room", 400);
    }
  }
);

// PATCH /api/rooms/:id/status (Quick update status - Owner & Penjaga)
roomRoutes.patch(
  "/:id/status",
  requireStaffOrOwner,
  zValidator("json", updateRoomStatusSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const updated = await RoomsService.updateRoomStatus(id, input);
      return successResponse(c, updated, "Room status updated successfully");
    } catch (error: any) {
      return errorResponse(c, error.message || "Failed to update room status", 400);
    }
  }
);

// DELETE /api/rooms/:id (Delete room)
roomRoutes.delete("/:id", requireOwner, async (c) => {
  try {
    const id = c.req.param("id");
    const result = await RoomsService.deleteRoom(id);
    return successResponse(c, result, "Room deleted successfully");
  } catch (error: any) {
    return errorResponse(c, error.message || "Failed to delete room", 400);
  }
});
