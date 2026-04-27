import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  JWT_SECRET: z.string().min(8).default('change-me-jwt'),
  SESSION_SECRET: z.string().min(8).default('change-me-session'),
  STORAGE_PATH: z.string().min(1).default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(2048).default(300),
  STORAGE_WARN_PCT: z.coerce.number().int().min(1).max(100).default(70),
  STORAGE_CRITICAL_PCT: z.coerce.number().int().min(1).max(100).default(85),
  MEDIA_RETENTION_DAYS: z.coerce.number().int().min(30).max(60).default(45),
  ALLOWED_ORIGINS: z.string().default('*'),
  ADMIN_EMAILS: z.string().default('pedrobraga855@gmail.com'),
});

const parsed = envSchema.parse(process.env);

if (parsed.STORAGE_CRITICAL_PCT <= parsed.STORAGE_WARN_PCT) {
  throw new Error('STORAGE_CRITICAL_PCT must be greater than STORAGE_WARN_PCT');
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const env = {
  ...parsed,
  ALLOWED_ORIGINS: parseCsv(parsed.ALLOWED_ORIGINS),
  ADMIN_EMAILS: parseCsv(parsed.ADMIN_EMAILS),
};

export type AppEnv = typeof env;
