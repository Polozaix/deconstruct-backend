import { AiPlanSchema, type AiPhase } from '@deconstruct/shared';
import { env } from '../../env';
import { logger } from '../../logger';
import { createGeminiProvider } from './gemini';
import { createOpenRouterProvider } from './openrouter';
import type { AiProvider } from './types';

export type { AiProvider } from './types';
export { buildPrompt } from './prompt';

let provider: AiProvider | null = null;

/**
 * Resolve the configured provider. Built lazily so the app (and its tests) can
 * start without an API key present.
 */
export function getAiProvider(): AiProvider {
  if (!provider) {
    provider =
      env.AI_PROVIDER === 'openrouter'
        ? createOpenRouterProvider()
        : createGeminiProvider();

    logger.info({ provider: provider.name, model: provider.model }, 'AI provider initialised');
  }
  return provider;
}

const MAX_ATTEMPTS = 2;

/**
 * Ask the configured LLM to break a problem into phases of tasks.
 *
 * The response is validated against AiPlanSchema and retried once: providers
 * differ in how strictly they enforce structured JSON, and a malformed plan
 * must never reach the scheduler.
 */
export async function deconstructProblem(
  problemText: string,
  dueDate: string | null
): Promise<AiPhase[]> {
  const ai = getAiProvider();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();

    try {
      const raw = await ai.deconstruct(problemText, dueDate);
      const parsed = AiPlanSchema.safeParse(raw);

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(
          `AI response failed validation (${issue?.path.join('.') || 'root'}: ${issue?.message})`
        );
      }

      const phases = parsed.data.phases.filter((phase) => phase.tasks.length > 0);
      if (phases.length === 0) {
        throw new Error('The AI returned a plan with no tasks.');
      }

      logger.debug(
        {
          provider: ai.name,
          model: ai.model,
          attempt,
          ms: Date.now() - startedAt,
          phases: phases.length,
        },
        'problem deconstructed'
      );

      return phases;
    } catch (error) {
      lastError = error;
      logger.warn(
        { err: error, provider: ai.name, model: ai.model, attempt },
        'AI deconstruction attempt failed'
      );
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'unknown error';
  throw new Error(`Failed to deconstruct the problem: ${message}`);
}
