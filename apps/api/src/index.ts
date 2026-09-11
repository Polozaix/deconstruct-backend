import app from './app';
import { env } from './env';
import { logger } from './logger';
import { disconnectDb } from './db';

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, model: env.GEMINI_MODEL },
    'Deconstruct API started'
  );
});

/** Close open connections before exiting so deploys are zero-downtime. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    try {
      await disconnectDb();
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
    } finally {
      process.exit(0);
    }
  });

  // Force-exit if graceful close hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});
