import { buildRoutine, type RoutineStep, type ScheduleInputStep } from '@deconstruct/scheduler';
import { breakdownRepo, serializeTask, type SerializedTask } from '../repos/breakdownRepo';
import { deconstructProblem } from './ai';
import { logger } from '../logger';

/** Single-user mode until Google auth lands in Phase 3. */
export const DEMO_USER_ID = 'demo_user';

/** Safety cap on AI-generated steps per project. */
const MAX_STEPS = 100;

interface ScheduledStep extends RoutineStep {
  itemId: number;
  status: string;
}

export interface ProcessProblemResult {
  taskId: number;
  problem: string;
  dueDate: string | null;
  dailyMinutes: number;
  steps: ScheduledStep[];
  routine: {
    days: ReturnType<typeof buildRoutine>['days'];
    totalMinutes: number;
    daysNeeded: number;
    fitsDeadline: boolean | null;
  };
}

export const taskService = {
  /**
   * Full pipeline: problem -> AI breakdown -> deterministic routine -> database.
   */
  async processProblem(
    problemText: string,
    dueDate: string | null,
    dailyMinutes: number
  ): Promise<ProcessProblemResult> {
    // 1. AI breaks the problem into phases with tasks
    const phases = await deconstructProblem(problemText, dueDate);

    // 2. Flatten phases into one ordered list of steps (sanity-capped)
    const rawSteps: ScheduleInputStep[] = [];
    for (const phase of phases) {
      for (const task of phase.tasks ?? []) {
        rawSteps.push({
          title: task.title,
          description: task.description,
          durationMinutes: task.durationMinutes,
          phase: phase.phase,
        });
      }
    }
    const cappedSteps = rawSteps.slice(0, MAX_STEPS);

    // 3. Deterministically schedule the steps
    const routine = buildRoutine(cappedSteps, { dailyMinutes, dueDate });
    const steps = routine.days.flatMap((day) => day.steps) as ScheduledStep[];

    // 4. Persist
    await breakdownRepo.ensureUser(DEMO_USER_ID);
    const { projectId, tasks } = await breakdownRepo.createProjectWithTasks(
      DEMO_USER_ID,
      problemText,
      dueDate,
      dailyMinutes,
      steps
    );

    // Attach persisted ids/status back onto the step objects. These objects are
    // shared with routine.days, so the client can render checkboxes from either.
    steps.forEach((step, index) => {
      const saved = tasks[index];
      if (saved) {
        step.itemId = saved.id;
        step.status = saved.status;
      }
    });

    logger.info({ projectId, steps: steps.length, days: routine.daysNeeded }, 'project created');

    return {
      taskId: projectId,
      problem: problemText,
      dueDate: dueDate ?? null,
      dailyMinutes,
      steps,
      routine: {
        days: routine.days,
        totalMinutes: routine.totalMinutes,
        daysNeeded: routine.daysNeeded,
        fitsDeadline: routine.fitsDeadline,
      },
    };
  },

  /** Get a project with its serialized steps. */
  async getTaskBreakdown(taskId: number) {
    const project = await breakdownRepo.findProjectWithTasks(taskId);
    if (!project) return null;

    const { tasks: taskRows, ...projectData } = project;
    return { ...projectData, steps: taskRows.map(serializeTask) };
  },

  /** Get the user's history, newest first, with serialized steps. */
  async getUserHistory(userId: string) {
    const projects = await breakdownRepo.listProjectsWithTasks(userId);
    return projects.map(({ tasks: taskRows, ...projectData }) => ({
      ...projectData,
      steps: taskRows.map(serializeTask),
    }));
  },

  /** Mark a step done or pending. Returns false when the step does not exist. */
  async setItemStatus(itemId: number, status: string): Promise<boolean> {
    const changes = await breakdownRepo.updateTaskStatus(itemId, status);
    return changes > 0;
  },

  /** Remove a project and its steps. Returns false when it does not exist. */
  async deleteBreakdown(taskId: number): Promise<boolean> {
    const changes = await breakdownRepo.deleteProject(taskId);
    return changes > 0;
  },
};

export type { SerializedTask };
