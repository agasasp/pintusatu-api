import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { errorResponse } from "../utils/response.js";
import type { StatusCode } from "hono/utils/http-status";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error("💥 Unhandled Error:", err);

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    return errorResponse(
      c,
      "Validation failed: Please check your input parameters",
      400,
      formattedErrors
    );
  }

  // 2. Hono Built-in HTTPException
  if (err instanceof HTTPException) {
    return errorResponse(c, err.message, err.status);
  }

  // 3. PostgreSQL Database Constraints
  const pgError = err as { code?: string; detail?: string; message?: string };
  if (pgError.code) {
    // 23505: Unique violation
    if (pgError.code === "23505") {
      return errorResponse(
        c,
        "Duplicate record: A record with this unique value already exists",
        409,
        pgError.detail || pgError.message
      );
    }

    // 23503: Foreign key violation
    if (pgError.code === "23503") {
      return errorResponse(
        c,
        "Referential integrity error: Referenced record not found or still in use",
        400,
        pgError.detail || pgError.message
      );
    }
  }

  // 4. Default Internal Server Error
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "An unexpected error occurred";

  return errorResponse(c, message, 500);
};
