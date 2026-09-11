import { z } from 'zod';

/** Minimum/maximum minutes of work allowed per day. */
export const DAILY_MINUTES_MIN = 15;
export const DAILY_MINUTES_MAX = 480;

export const TASK_STATUSES = ['pending', 'done'] as const;
export const TaskStatusSchema = z.enum(TASK_STATUSES);

/**
 * Body accepted by POST /api/deconstruct.
 * `dailyMinutes` accepts a number (15-480), the literal "same"
 * (do it all in one day), or a numeric string.
 */
export const DeconstructRequestSchema = z.object({
  problem: z
    .string()
    .trim()
    .min(3, 'Please provide a problem description (at least 3 characters).')
    .max(2000, 'Problem description is too long (max 2000 characters).'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be in YYYY-MM-DD format.')
    .nullish(),
  dailyMinutes: z
    .union([z.literal('same'), z.number().int(), z.string().regex(/^\d+$/)])
    .optional(),
});

export type DeconstructRequest = z.infer<typeof DeconstructRequestSchema>;

/** Body accepted by PATCH /api/item/:itemId */
export const UpdateItemStatusSchema = z.object({
  status: TaskStatusSchema,
});

export type UpdateItemStatus = z.infer<typeof UpdateItemStatusSchema>;

/**
 * Normalise the raw `dailyMinutes` input into the number the scheduler expects.
 * 0 means "same day" (no daily cap).
 */
export function normalizeDailyMinutes(value: unknown): number {
  if (value === 'same' || value === 0 || value === '0') return 0;
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(Math.max(parsed, DAILY_MINUTES_MIN), DAILY_MINUTES_MAX);
}

// ---------------------------------------------------------------------------
// AI output contract
//
// Providers differ in how strictly they enforce structure, so the model's
// response is always validated against these schemas before it reaches the
// scheduler. Invalid output is retried instead of corrupting a plan.
// ---------------------------------------------------------------------------

export const AiTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
});

export const AiPhaseSchema = z.object({
  phase: z.string().trim().min(1).max(120),
  tasks: z.array(AiTaskSchema),
});

export const AiPlanSchema = z.object({
  phases: z.array(AiPhaseSchema).min(1),
});

export type AiTask = z.infer<typeof AiTaskSchema>;
export type AiPhase = z.infer<typeof AiPhaseSchema>;
export type AiPlan = z.infer<typeof AiPlanSchema>;

/** JSON shape the prompt asks every provider to return. */
export const AI_PLAN_JSON_SHAPE =
  '{"phases":[{"phase":"string","tasks":[{"title":"string","description":"string","durationMinutes":30}]}]}';

