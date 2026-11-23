// backend/lib/env.ts

import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test", "dev"])
    .default("development"),
  FRONTEND_URL: z.string().url(),
  MEDIA_STORAGE_DIR: z.string().optional(),
  MEDIA_THUMBNAIL_DIR: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().min(1),

  // Database
  DATABASE_URL: z.string().min(1),
  PGSSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  // Redis
  REDIS_URL: z.string().url(),

  // AI providers
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_API_NAME: z.string().default("MemoraAI"),
  GEMINI_API_PROJECT_NAME: z.string().optional(),
  GEMINI_API_PROJECT_NUMBER: z.string().optional(),

  // Python face service
  FACE_SERVICE_URL: z.string().url().default("http://127.0.0.1:8000"),
});

export const env = envSchema.parse(process.env);
