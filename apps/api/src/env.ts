import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration. Validated once at boot so misconfiguration fails
 * fast and loudly instead of surfacing as a confusing runtime error later.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),

  // Comma-separated allowlist, or "*" for any origin.
  CORS_ORIGINS: z.string().default('*'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;

// Production cannot run without a database or an AI key.
if (raw.NODE_ENV === 'production') {
  const missing = (['DATABASE_URL', 'GEMINI_API_KEY'] as const).filter((key) => !raw[key]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required production environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = raw;

export const corsOrigins: string | string[] =
  raw.CORS_ORIGINS === '*'
    ? '*'
    : raw.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

export const isProduction = raw.NODE_ENV === 'production';
export const isTest = raw.NODE_ENV === 'test';
