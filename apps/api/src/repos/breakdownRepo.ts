import type { Task } from '@prisma/client';
import { prisma } from '../db';
import type { RoutineStep } from '@deconstruct/scheduler';

/** A step as stored, plus the persisted id/status needed by the client. */
export interface SerializedTask {
  id: number;
  projectId: number;
  stepOrder: number;
  phase: string | null;
  title: string;
  description: string;
  durationMinutes: number;
  status: string;
  /** Assigned day as YYYY-MM-DD (date-only column). */
  assignedDay: string | null;
  startTime: string | null;
  createdAt: Date;
}

/** Format a date-only column without shifting across timezones. */
export function toDateOnlyString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string into a UTC-midnight Date (safe for @db.Date). */
function fromDateOnlyString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function serializeTask(task: Task): SerializedTask {
  return {
    id: task.id,
    projectId: task.projectId,
    stepOrder: task.stepOrder,
    phase: task.phase,
    title: task.title,
    description: task.description,
    durationMinutes: task.durationMinutes,
    status: task.status,
    assignedDay: task.assignedDate ? toDateOnlyString(task.assignedDate) : null,
    startTime: task.startTime,
    createdAt: task.createdAt,
  };
}

export const breakdownRepo = {
  /** Ensure the (currently single) demo user row exists. */
  async ensureUser(userId: string): Promise<void> {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: 'Demo User' },
    });
  },

  /** Persist a project and all of its scheduled steps atomically. */
  async createProjectWithTasks(
    userId: string,
    problem: string,
    dueDate: string | null,
    dailyMinutes: number,
    steps: RoutineStep[]
  ): Promise<{ projectId: number; tasks: Task[] }> {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          userId,
          problem,
          dueDate: dueDate ? fromDateOnlyString(dueDate) : null,
          dailyMinutes,
        },
      });

      await tx.task.createMany({
        data: steps.map((step) => ({
          projectId: project.id,
          stepOrder: step.stepOrder,
          phase: step.phase || null,
          title: step.title,
          description: step.description || '',
          durationMinutes: step.durationMinutes,
          status: 'pending',
          assignedDate: step.assignedDay ? fromDateOnlyString(step.assignedDay) : null,
          startTime: step.startTime || null,
        })),
      });

      const tasks = await tx.task.findMany({
        where: { projectId: project.id },
        orderBy: { stepOrder: 'asc' },
      });

      return { projectId: project.id, tasks };
    });
  },

  async findProjectWithTasks(id: number) {
    return prisma.project.findUnique({
      where: { id },
      include: { tasks: { orderBy: { stepOrder: 'asc' } } },
    });
  },

  async listProjectsWithTasks(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { tasks: { orderBy: { stepOrder: 'asc' } } },
    });
  },

  async updateTaskStatus(id: number, status: string): Promise<number> {
    const result = await prisma.task.updateMany({ where: { id }, data: { status } });
    return result.count;
  },

  /** Deleting a project cascades to its tasks (ON DELETE CASCADE). */
  async deleteProject(id: number): Promise<number> {
    const result = await prisma.project.deleteMany({ where: { id } });
    return result.count;
  },
};
