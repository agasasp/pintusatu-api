import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema.js";
import { env } from "./env.js";

// For connection pooling with Postgres.js
const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 20 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // Suppress notices in output
});

export const db = drizzle(queryClient, { schema });
export const rawSql = queryClient;
export type Database = typeof db;
