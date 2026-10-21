import type { MiddlewareHandler } from "hono";

export const requestLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = (performance.now() - start).toFixed(2);
    const status = c.res.status;

    const statusColor =
      status >= 500
        ? "\x1b[31m" // Red
        : status >= 400
        ? "\x1b[33m" // Yellow
        : status >= 300
        ? "\x1b[36m" // Cyan
        : "\x1b[32m"; // Green
    const reset = "\x1b[0m";

    console.log(
      `[${new Date().toISOString()}] ${method} ${path} -> ${statusColor}${status}${reset} (${duration}ms)`
    );
  };
};
