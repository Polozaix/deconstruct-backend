/**
 * Deterministic routine builder.
 *
 * This package is intentionally pure: it performs no I/O and has no
 * dependencies, so it can be unit-tested exhaustively. All of the "hard"
 * scheduling arithmetic lives here rather than in the LLM.
 *
 * Phase 1 keeps the original greedy behaviour (fill each day up to
 * `dailyMinutes` starting at 09:00). Phase 2 replaces the internals with a
 * calendar-aware scheduler (availability windows, dependencies, critical
 * path, buffers) while keeping this public API stable.
 */

export const DAY_START_HOUR = 9;

/** A single decomposed step handed to the scheduler. */
export interface ScheduleInputStep {
  title: string;
  description?: string;
  durationMinutes: number;
  /** Project phase this step belongs to (optional). */
  phase?: string;
}

export interface BuildRoutineOptions {
  /** Max minutes of work per day. 0 / falsy means "same day" (no daily cap). */
  dailyMinutes?: number;
  /** Optional deadline as YYYY-MM-DD. */
  dueDate?: string | null;
  /** Date the routine starts from (defaults to today). */
  startDate?: Date;
  /** Clock time the working day starts at (24h hour, default 9). */
  dayStartHour?: number;
}

export interface RoutineStep {
  stepOrder: number;
  phase: string;
  title: string;
  description: string;
  durationMinutes: number;
  /** Assigned day as YYYY-MM-DD. */
  assignedDay: string;
  /** Start time as HH:MM. */
  startTime: string;
}

export interface RoutineDay {
  day: number;
  date: string;
  steps: RoutineStep[];
}

export interface Routine {
  days: RoutineDay[];
  totalMinutes: number;
  daysNeeded: number;
  fitsDeadline: boolean | null;
}

export const MIN_TASK_MINUTES = 5;
export const MAX_TASK_MINUTES = 240;

/** Format a Date as a local YYYY-MM-DD string (avoids UTC shifting the day). */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Clamp an arbitrary duration to a sane task length. */
export function clampDuration(value: unknown, fallback = 30): number {
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, MIN_TASK_MINUTES), MAX_TASK_MINUTES);
}

/**
 * Turn an ordered list of steps into a day-by-day routine.
 */
export function buildRoutine(
  steps: ScheduleInputStep[],
  options: BuildRoutineOptions = {}
): Routine {
  const dailyMinutes = options.dailyMinutes ?? 0;
  const dueDate = options.dueDate ?? null;
  const dayStartHour = options.dayStartHour ?? DAY_START_HOUR;

  const sameDay = !dailyMinutes || dailyMinutes <= 0;
  const days: RoutineDay[] = [];
  let totalMinutes = 0;

  let dayIndex = 0;
  let minutesUsedToday = 0;
  let clockMinutes = dayStartHour * 60;
  let currentDay: RoutineDay | null = null;

  const start = options.startDate ? new Date(options.startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  steps.forEach((step, index) => {
    const duration = clampDuration(step.durationMinutes);

    // Not enough room left today -> start a new day
    // (skipped in same-day mode: no daily cap)
    if (!currentDay || (!sameDay && minutesUsedToday + duration > dailyMinutes)) {
      dayIndex += 1;
      minutesUsedToday = 0;
      clockMinutes = dayStartHour * 60;

      const date = new Date(start);
      date.setDate(start.getDate() + (dayIndex - 1));

      currentDay = {
        day: dayIndex,
        date: formatDate(date),
        steps: [],
      };
      days.push(currentDay);
    }

    const startHour = Math.floor(clockMinutes / 60);
    const startMin = clockMinutes % 60;
    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

    clockMinutes += duration;
    minutesUsedToday += duration;
    totalMinutes += duration;

    currentDay.steps.push({
      stepOrder: index + 1,
      phase: step.phase || '',
      title: step.title,
      description: step.description || '',
      durationMinutes: duration,
      assignedDay: currentDay.date,
      startTime,
    });
  });

  // Basic deadline check
  let fitsDeadline: boolean | null = null;
  if (dueDate && days.length > 0) {
    const due = new Date(`${dueDate}T23:59:59`);
    const lastDay = new Date(`${days[days.length - 1].date}T23:59:59`);
    fitsDeadline = lastDay <= due;
  }

  return {
    days,
    totalMinutes,
    daysNeeded: days.length,
    fitsDeadline,
  };
}
