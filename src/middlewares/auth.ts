import type { MiddlewareHandler } from "hono";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { errorResponse } from "../utils/response.js";
import { db } from "../config/db.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "owner" | "penjaga" | "tenant";
  ownerId?: string | null;
  isImpersonated?: boolean;
  impersonatedBy?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const authMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(c, "Unauthorized: Missing or malformed Bearer token", 401);
    }

    const token = authHeader.substring(7).trim();

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;

      // Verify user still exists and is active in database
      const [existingUser] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          ownerId: users.ownerId,
        })
        .from(users)
        .where(eq(users.id, decoded.id))
        .limit(1);

      if (!existingUser) {
        return errorResponse(c, "Unauthorized: User account not found", 401);
      }

      if (!existingUser.isActive) {
        return errorResponse(c, "Forbidden: User account has been deactivated or suspended", 403);
      }

      const authenticatedUser: AuthUser = {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        ownerId: existingUser.ownerId,
        isImpersonated: decoded.isImpersonated,
        impersonatedBy: decoded.impersonatedBy,
      };

      c.set("user", authenticatedUser);
      await next();
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === "TokenExpiredError") {
        return errorResponse(c, "Unauthorized: Token has expired", 401);
      }
      return errorResponse(c, "Unauthorized: Invalid token signature", 401);
    }
  };
};

export const requireRole = (allowedRoles: Array<AuthUser["role"]>): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return errorResponse(c, "Unauthorized: Authentication required", 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return errorResponse(
        c,
        `Forbidden: Role '${user.role}' is not authorized to access this resource`,
        403
      );
    }

    await next();
  };
};

export const requireSuperadmin = requireRole(["superadmin"]);
export const requireOwner = requireRole(["owner", "superadmin"]);
export const requireStaffOrOwner = requireRole(["owner", "penjaga", "superadmin"]);

/**
 * Returns the effective owner ID for data scoping.
 * - Owner: their own user ID
 * - Penjaga: their employer's ownerId
 * - Superadmin: their user ID or target owner ID
 */
export const getEffectiveOwnerId = (user: AuthUser): string => {
  if (user.role === "penjaga" && user.ownerId) {
    return user.ownerId;
  }
  return user.id;
};
