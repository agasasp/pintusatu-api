import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/pintusatu_db"),
  JWT_SECRET: z.string().min(16).default("super-secret-jwt-token-key-pintusatu-indonesia-2026"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((val) => val.split(",").map((origin) => origin.trim())),
  MIDTRANS_SERVER_KEY: z.string().optional().default("SB-Mid-server-sandbox-test-12345"),
  XENDIT_SECRET_KEY: z.string().optional().default("xnd_development_test_12345"),
  WHATSAPP_API_TOKEN: z.string().optional().default("wa_gateway_sample_token_2026"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables configuration:", parsedEnv.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
