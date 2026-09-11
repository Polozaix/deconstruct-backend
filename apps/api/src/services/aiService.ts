import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../env';
import { logger } from '../logger';

export interface DeconstructedTask {
  title: string;
  description: string;
  durationMinutes: number;
}

export interface DeconstructedPhase {
  phase: string;
  tasks: DeconstructedTask[];
}

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
 * Ask Gemini to deconstruct a problem into phases, each containing ordered,
 * actionable tasks. The plan scales with the real scope of the problem.
 *
 * The model only *reasons* here (breakdown + effort estimates). All scheduling
 * arithmetic is done deterministically by @deconstruct/scheduler.
 */
export async function deconstructProblem(
  problemText: string,
  dueDate: string | null
): Promise<DeconstructedPhase[]> {
  const deadlineLine = dueDate
    ? `The deadline is: "${dueDate}".`
    : 'There is no hard deadline.';

  const prompt = `You are an expert project manager.
The user needs to solve this problem: "${problemText}".
${deadlineLine}
Deconstruct it into chronological phases, and each phase into concrete, actionable tasks.

CRITICAL: scale the plan to the REAL scope of the problem:
- A small everyday problem (e.g. "cook dinner for 3 people") = ONE phase with 3-5 short tasks (10-60 min each).
- A medium project (e.g. "build a personal website") = 3-5 phases with several tasks each.
- A large professional-level project (e.g. "make a game at a professional level") = MANY phases
  (e.g. concept, design, prototyping, core production, content, testing, polish, release,
  post-launch) with MANY tasks per phase - realistically dozens of tasks total, and individual
  tasks can take 30-240 minutes.
Never underestimate a large project: a professional-quality result requires professional-scale
effort. If it would take weeks or months in reality, the plan must reflect that.
Give each task a short title, a one-sentence description, and a realistic duration in minutes.`;

  const startedAt = Date.now();

  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
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
                  title: { type: Type.STRING, description: 'Short, actionable name of the task' },
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
  });

  const text = response.text;
  if (!text) {
    throw new Error('The AI returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The AI returned malformed JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('The AI returned an unexpected response shape.');
  }

  logger.debug({ ms: Date.now() - startedAt, phases: parsed.length }, 'problem deconstructed');
  return parsed as DeconstructedPhase[];
}
