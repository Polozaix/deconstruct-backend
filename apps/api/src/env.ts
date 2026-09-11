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

  // AI: "gemini" (native SDK, strict schema) or "openrouter" (OpenAI-compatible
  // transport - also covers OpenAI, Groq, Together, or a local Ollama).
  AI_PROVIDER: z.enum(['gemini', 'openrouter']).default('gemini'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.5-flash'),
  OPENROUTER_SITE_URL: z.string().optional(),
  OPENROUTER_APP_NAME: z.string().default('Deconstruct.ai'),

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

// Production cannot run without a database or the key for the selected provider.
if (raw.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!raw.DATABASE_URL) missing.push('DATABASE_URL');

  if (raw.AI_PROVIDER === 'openrouter') {
    if (!raw.OPENROUTER_API_KEY) missing.push('OPENROUTER_API_KEY');
  } else if (!raw.GEMINI_API_KEY) {
    missing.push('GEMINI_API_KEY');
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required production environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = raw;

/** Model the configured AI provider will use (for logging). */
export const aiModel =
  raw.AI_PROVIDER === 'openrouter' ? raw.OPENROUTER_MODEL : raw.GEMINI_MODEL;

export const corsOrigins: string | string[] =
  raw.CORS_ORIGINS === '*'
    ? '*'
    : raw.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

export const isProduction = raw.NODE_ENV === 'production';
export const isTest = raw.NODE_ENV === 'test';
