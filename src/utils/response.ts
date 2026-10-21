import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: unknown;
}

export const successResponse = <T>(
  c: Context,
  data: T,
  message = "Operation successful",
  statusCode: ContentfulStatusCode = 200,
  meta?: PaginationMeta
) => {
  const response: ApiResponse<T> = {
    success: true,
    statusCode,
    message,
    data,
    ...(meta && { meta }),
  };

  return c.json(response, statusCode);
};

export const errorResponse = (
  c: Context,
  message = "An error occurred",
  statusCode: ContentfulStatusCode = 400,
  errors?: unknown
) => {
  const response: ApiResponse = {
    success: false,
    statusCode,
    message,
    ...(errors !== undefined && { errors }),
  };

  return c.json(response, statusCode);
};

export const calculatePagination = (total: number, page = 1, limit = 10): PaginationMeta => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 10);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
};
