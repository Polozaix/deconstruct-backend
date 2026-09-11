import type { AiPlan } from '@deconstruct/shared';

/**
 * The one capability the app needs from an LLM. Providers only *reason*
 * (break the problem down and estimate effort) - all scheduling arithmetic is
 * done deterministically by @deconstruct/scheduler.
 */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** Returns the raw parsed JSON; the caller validates it against AiPlanSchema. */
  deconstruct(problemText: string, dueDate: string | null): Promise<AiPlan>;
}
