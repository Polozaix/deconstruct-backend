import path from 'path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { corsOrigins, isProduction } from './env';
import { logger } from './logger';
import apiRoutes from './routes/apiRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { pingDb } from './db';

const VERSION = process.env.npm_package_version ?? '1.0.0';

export function createApp(): express.Express {
  const app = express();

  // Behind Render's proxy - trust it for correct client IPs / rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  // The temporary frontend uses inline scripts, so CSP is disabled for now.
  // Phase 5 (React SPA) will re-enable a strict CSP.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { id: string }).id,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
    })
  );
  app.use(generalLimiter);

  // Liveness: process is up.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: VERSION, uptime: process.uptime() });
  });

  // Readiness: dependencies reachable.
  app.get('/ready', async (_req, res) => {
    try {
      await pingDb();
      res.json({ status: 'ready' });
    } catch (error) {
      logger.error({ err: error }, 'readiness check failed');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api', apiRoutes);

  // Static frontend + SPA fallback (never for /api routes).
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Exported directly so tests can use supertest without binding a port.
const app = createApp();
export default app;
export { isProduction };
