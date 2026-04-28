import 'dotenv/config';

import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

const productionSecret = (label: string) =>
  z
    .string()
    .min(isProduction ? 32 : 8, `${label} deve ter no mínimo ${isProduction ? 32 : 8} caracteres`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(7741),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  JWT_SECRET: productionSecret('JWT_SECRET').default(
    isProduction ? '' : 'dev-jwt-secret-change-me',
  ),
  SESSION_SECRET: productionSecret('SESSION_SECRET').default(
    isProduction ? '' : 'dev-session-secret-change-me',
  ),
  API_ADMIN_TOKEN: productionSecret('API_ADMIN_TOKEN').default(
    isProduction ? '' : 'dev-admin-token-change-me',
  ),
  STORAGE_PATH: z.string().min(1).default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(2048).default(300),
  STORAGE_WARN_PCT: z.coerce.number().int().min(1).max(100).default(70),
  STORAGE_CRITICAL_PCT: z.coerce.number().int().min(1).max(100).default(85),
  MEDIA_RETENTION_DAYS: z.coerce.number().int().min(30).max(60).default(45),
  ALLOWED_ORIGINS: z.string().default(isProduction ? '' : '*'),
  ADMIN_EMAILS: z.string().default('pedrobraga855@gmail.com'),
});

const parsed = envSchema.parse(process.env);

if (parsed.STORAGE_CRITICAL_PCT <= parsed.STORAGE_WARN_PCT) {
  throw new Error('STORAGE_CRITICAL_PCT must be greater than STORAGE_WARN_PCT');
}

if (isProduction) {
  if (parsed.ALLOWED_ORIGINS.trim() === '' || parsed.ALLOWED_ORIGINS.includes('*')) {
    throw new Error('ALLOWED_ORIGINS deve conter origens explícitas em produção (sem "*")');
  }
  for (const [key, value] of [
    ['JWT_SECRET', parsed.JWT_SECRET],
    ['SESSION_SECRET', parsed.SESSION_SECRET],
    ['API_ADMIN_TOKEN', parsed.API_ADMIN_TOKEN],
  ] as const) {
    if (!value) {
      throw new Error(`${key} é obrigatório em produção`);
    }
  }
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
