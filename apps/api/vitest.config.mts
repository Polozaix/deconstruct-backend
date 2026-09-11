import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Deterministic, isolated env for tests: no real DB connection is made
    // (PrismaClient only connects on first query) and no AI calls are issued.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-3.6-flash',
      CORS_ORIGINS: '*',
    },
  },
});
