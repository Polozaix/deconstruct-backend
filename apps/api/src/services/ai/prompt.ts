import { AI_PLAN_JSON_SHAPE } from '@deconstruct/shared';

export const SYSTEM_INSTRUCTION =
  'You are an expert project manager. You respond with strict JSON only - no markdown, no commentary.';

/**
 * Shared prompt for every provider. The model only reasons here: it decides the
 * phases/tasks and estimates effort. It must not try to schedule anything.
 */
export function buildPrompt(problemText: string, dueDate: string | null): string {
  const deadlineLine = dueDate
    ? `The deadline is: "${dueDate}".`
    : 'There is no hard deadline.';

  return `The user needs to solve this problem: "${problemText}".
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

Give each task a short title, a one-sentence description, and a realistic duration in minutes.

Respond with ONLY a JSON object in exactly this shape:
${AI_PLAN_JSON_SHAPE}`;
}
