import type { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wrap an async route handler so rejected promises reach the error middleware.
 * (Express 5 forwards these natively, but being explicit keeps behaviour
 * identical if the handler is reused elsewhere.)
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
