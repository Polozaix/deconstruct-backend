import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';
import { isProduction } from '../env';

/** An error with an explicit HTTP status code. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Terminal handler for unknown routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found.' });
}

/**
 * Central error handler. Must keep four parameters for Express to treat it as
 * an error handler.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Unknown error';

  if (status >= 500) {
    logger.error({ err, path: req.path, requestId: req.id }, 'request failed');
  } else {
    logger.warn({ path: req.path, requestId: req.id, message }, 'request rejected');
  }

  if (res.headersSent) return;

  res.status(status).json({
    error: status >= 500 && isProduction ? 'Internal server error.' : message,
    requestId: req.id,
  });
}
