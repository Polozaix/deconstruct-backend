import rateLimit from 'express-rate-limit';
import { isTest } from '../env';

/** Global limiter applied to every request. */
export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: isTest ? 100_000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

/**
 * Stricter limiter for the AI endpoint - protects both the service and your
 * Gemini quota/bill.
 */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: isTest ? 100_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a minute and try again.' },
});
