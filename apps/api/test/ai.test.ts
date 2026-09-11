import { AiPlanSchema } from '@deconstruct/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the vi.mock factory below can reference it safely.
const { deconstruct } = vi.hoisted(() => ({ deconstruct: vi.fn() }));

vi.mock('../src/services/ai/gemini', () => ({
  createGeminiProvider: () => ({ name: 'gemini', model: 'test-model', deconstruct }),
}));

// Imported after the mock so the factory is replaced.
import { deconstructProblem } from '../src/services/ai';

const validPlan = {
  phases: [
    { phase: 'Concept', tasks: [{ title: 'Draft the idea', description: 'One sentence', durationMinutes: 30 }] },
  ],
};

describe('AiPlanSchema', () => {
  it('accepts a well-formed plan', () => {
    expect(AiPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it('coerces a string duration and applies defaults', () => {
    const result = AiPlanSchema.safeParse({
      phases: [{ phase: 'Concept', tasks: [{ title: 'Draft', durationMinutes: '45' }] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phases[0].tasks[0].durationMinutes).toBe(45);
      expect(result.data.phases[0].tasks[0].description).toBe('');
    }
  });

  it('rejects an empty plan, a missing title, and a non-object response', () => {
    expect(AiPlanSchema.safeParse({ phases: [] }).success).toBe(false);
    expect(
      AiPlanSchema.safeParse({ phases: [{ phase: 'X', tasks: [{ description: 'no title' }] }] }).success
    ).toBe(false);
    expect(AiPlanSchema.safeParse([validPlan.phases[0]]).success).toBe(false);
  });
});

describe('deconstructProblem', () => {
  beforeEach(() => {
    deconstruct.mockReset();
  });

  it('returns validated phases', async () => {
    deconstruct.mockResolvedValue(validPlan);

    const phases = await deconstructProblem('build a game', null);

    expect(phases).toHaveLength(1);
    expect(phases[0].phase).toBe('Concept');
    expect(deconstruct).toHaveBeenCalledTimes(1);
  });

  it('retries once when the first response is malformed, then succeeds', async () => {
    deconstruct
      .mockResolvedValueOnce({ phases: 'not-an-array' })
      .mockResolvedValueOnce(validPlan);

    const phases = await deconstructProblem('build a game', null);

    expect(phases).toHaveLength(1);
    expect(deconstruct).toHaveBeenCalledTimes(2);
  });

  it('gives up after repeated invalid responses', async () => {
    deconstruct.mockResolvedValue({ phases: [] });

    await expect(deconstructProblem('build a game', null)).rejects.toThrow(/no tasks|validation/i);
    expect(deconstruct).toHaveBeenCalledTimes(2);
  });

  it('drops phases that contain no tasks', async () => {
    deconstruct.mockResolvedValue({
      phases: [
        { phase: 'Empty', tasks: [] },
        { phase: 'Real', tasks: [{ title: 'T', description: '', durationMinutes: 10 }] },
      ],
    });

    const phases = await deconstructProblem('build a game', null);

    expect(phases.map((phase) => phase.phase)).toEqual(['Real']);
  });
});
