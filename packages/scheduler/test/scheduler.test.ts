import { describe, expect, it } from 'vitest';
import { buildRoutine, formatDate, clampDuration, type ScheduleInputStep } from '../src';

const step = (title: string, durationMinutes: number): ScheduleInputStep => ({
  title,
  description: '',
  durationMinutes,
});

describe('clampDuration', () => {
  it('clamps to the allowed range', () => {
    expect(clampDuration(1)).toBe(5);
    expect(clampDuration(30)).toBe(30);
    expect(clampDuration(9999)).toBe(240);
  });

  it('falls back when the value is not a number', () => {
    expect(clampDuration('abc')).toBe(30);
    expect(clampDuration(undefined)).toBe(30);
  });
});

describe('formatDate', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('buildRoutine', () => {
  it('returns an empty routine for no steps', () => {
    const routine = buildRoutine([]);
    expect(routine.days).toHaveLength(0);
    expect(routine.daysNeeded).toBe(0);
    expect(routine.totalMinutes).toBe(0);
    expect(routine.fitsDeadline).toBeNull();
  });

  it('puts everything on one day in same-day mode (dailyMinutes: 0)', () => {
    const routine = buildRoutine([step('a', 60), step('b', 90)], { dailyMinutes: 0 });
    expect(routine.daysNeeded).toBe(1);
    expect(routine.totalMinutes).toBe(150);
    expect(routine.days[0].steps).toHaveLength(2);
    expect(routine.days[0].steps[0].startTime).toBe('09:00');
    expect(routine.days[0].steps[1].startTime).toBe('10:00');
  });

  it('spreads steps across days according to the daily budget', () => {
    const routine = buildRoutine(
      [step('a', 60), step('b', 60), step('c', 60)],
      { dailyMinutes: 120 }
    );
    expect(routine.daysNeeded).toBe(2);
    expect(routine.days[0].steps).toHaveLength(2);
    expect(routine.days[1].steps).toHaveLength(1);
    expect(routine.days[1].steps[0].startTime).toBe('09:00');
  });

  it('assigns sequential step order and dates across days', () => {
    const startDate = new Date(2026, 4, 1); // 2026-05-01
    const routine = buildRoutine(
      [step('a', 60), step('b', 60), step('c', 60)],
      { dailyMinutes: 60, startDate }
    );
    expect(routine.days.map((d) => d.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
    expect(routine.days.flatMap((d) => d.steps).map((s) => s.stepOrder)).toEqual([1, 2, 3]);
  });

  it('detects when a plan does not fit the deadline', () => {
    const startDate = new Date(2026, 4, 1);
    const routine = buildRoutine(
      [step('a', 60), step('b', 60), step('c', 60)],
      { dailyMinutes: 60, dueDate: '2026-05-02', startDate }
    );
    expect(routine.daysNeeded).toBe(3);
    expect(routine.fitsDeadline).toBe(false);
  });

  it('detects when a plan fits the deadline', () => {
    const startDate = new Date(2026, 4, 1);
    const routine = buildRoutine([step('a', 60), step('b', 60)], {
      dailyMinutes: 60,
      dueDate: '2026-05-05',
      startDate,
    });
    expect(routine.fitsDeadline).toBe(true);
  });

  it('carries the phase through to the scheduled step', () => {
    const routine = buildRoutine([{ ...step('a', 30), phase: 'Design' }], { dailyMinutes: 0 });
    expect(routine.days[0].steps[0].phase).toBe('Design');
  });
});
