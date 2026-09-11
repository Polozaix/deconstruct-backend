import { GoogleGenAI, Type } from '@google/genai';
import type { AiPlan } from '@deconstruct/shared';
import { env } from '../../env';
import { buildPrompt } from './prompt';
import type { AiProvider } from './types';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Gemini provider. Uses the native SDK's strict `responseSchema`, which is the
 * most reliable way to get structured output from this family of models.
 */
export function createGeminiProvider(): AiProvider {
  const model = env.GEMINI_MODEL;

  return {
    name: 'gemini',
    model,

    async deconstruct(problemText: string, dueDate: string | null): Promise<AiPlan> {
      const response = await getClient().models.generateContent({
        model,
        contents: buildPrompt(problemText, dueDate),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              phases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phase: {
                      type: Type.STRING,
                      description: 'Name of the project phase (e.g. "Concept", "Prototyping")',
                    },
                    tasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: {
                            type: Type.STRING,
                            description: 'Short, actionable name of the task',
                          },
                          description: {
                            type: Type.STRING,
                            description: 'One sentence explaining what to do',
                          },
                          durationMinutes: {
                            type: Type.INTEGER,
                            description: 'Realistic minutes to complete (10-240)',
                          },
                        },
                        required: ['title', 'description', 'durationMinutes'],
                      },
                    },
                  },
                  required: ['phase', 'tasks'],
                },
              },
            },
            required: ['phases'],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error('Gemini returned an empty response.');
      return JSON.parse(text) as AiPlan;
    },
  };
}
