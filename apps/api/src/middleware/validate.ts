import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Validate and replace `req.body` with the parsed result.
 * (Only the body is writable in Express 5; params/query are validated inline.)
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join('.') ?? '';
      res.status(400).json({
        error: issue ? `${path || 'request'}: ${issue.message}` : 'Invalid request body.',
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Parse a positive integer route parameter, or return null. */
export function parsePositiveIntParam(value: unknown): number | null {
  // Express 5 types route params as string | string[].
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
