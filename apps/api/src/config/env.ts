import 'dotenv/config';

import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

const adminTokenSchema = z
  .string()
  .min(
    isProduction ? 32 : 8,
    `API_ADMIN_TOKEN deve ter no mínimo ${isProduction ? 32 : 8} caracteres`,
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(7741),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  API_ADMIN_TOKEN: adminTokenSchema.default(isProduction ? '' : 'dev-admin-token-change-me'),
  STORAGE_PATH: z.string().min(1).default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(2048).default(300),
  ALLOWED_ORIGINS: z.string().default(isProduction ? '' : '*'),
});

const parsed = envSchema.parse(process.env);

if (isProduction) {
  if (parsed.ALLOWED_ORIGINS.trim() === '' || parsed.ALLOWED_ORIGINS.includes('*')) {
    throw new Error('ALLOWED_ORIGINS deve conter origens explícitas em produção (sem "*")');
  }
  if (!parsed.API_ADMIN_TOKEN) {
    throw new Error('API_ADMIN_TOKEN é obrigatório em produção');
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
};

export type AppEnv = typeof env;
