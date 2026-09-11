import pino from 'pino';
import { env, isProduction, isTest } from './env';

/**
 * Structured application logger. Uses pretty output in development only so that
 * production emits machine-readable JSON.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});
