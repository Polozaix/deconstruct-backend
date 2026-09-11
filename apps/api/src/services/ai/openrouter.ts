import OpenAI from 'openai';
import type { AiPlan } from '@deconstruct/shared';
import { env } from '../../env';
import { SYSTEM_INSTRUCTION, buildPrompt } from './prompt';
import type { AiProvider } from './types';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured.');
    }

    client = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      timeout: env.AI_TIMEOUT_MS,
      maxRetries: 2,
      // OpenRouter uses these to attribute traffic (optional but recommended).
      defaultHeaders: {
        ...(env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': env.OPENROUTER_SITE_URL } : {}),
        ...(env.OPENROUTER_APP_NAME ? { 'X-Title': env.OPENROUTER_APP_NAME } : {}),
      },
    });
  }
  return client;
}

/**
 * OpenRouter (and any OpenAI-compatible endpoint).
 *
 * OpenRouter fronts hundreds of models with varying structured-output support,
 * so we request plain JSON mode and rely on AiPlanSchema validation + retry in
 * the caller rather than a provider-specific strict schema. Because the
 * transport is the OpenAI wire format, this also works unchanged against
 * OpenAI, Groq, Together, or a local Ollama server by changing
 * OPENROUTER_BASE_URL.
 */
export function createOpenRouterProvider(): AiProvider {
  const model = env.OPENROUTER_MODEL;

  return {
    name: 'openrouter',
    model,

    async deconstruct(problemText: string, dueDate: string | null): Promise<AiPlan> {
      const completion = await getClient().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: buildPrompt(problemText, dueDate) },
        ],
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error('The AI provider returned an empty response.');
      return JSON.parse(text) as AiPlan;
    },
  };
}
