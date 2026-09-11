import type { Request, Response } from 'express';
import { normalizeDailyMinutes, type DeconstructRequest } from '@deconstruct/shared';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { parsePositiveIntParam } from '../middleware/validate';
import { DEMO_USER_ID, taskService } from '../services/taskService';

// POST /api/deconstruct
// Body: { problem: string, dueDate?: "YYYY-MM-DD", dailyMinutes?: number | "same" }
export const handleDeconstruct = asyncHandler(async (req: Request, res: Response) => {
  const { problem, dueDate, dailyMinutes } = req.body as DeconstructRequest;
  const minutes = normalizeDailyMinutes(dailyMinutes);

  const result = await taskService.processProblem(problem, dueDate ?? null, minutes);
  res.json({ success: true, ...result });
});

// GET /api/task/:taskId
export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const taskId = parsePositiveIntParam(req.params.taskId);
  if (taskId === null) throw new HttpError(400, 'Invalid task id.');

  const task = await taskService.getTaskBreakdown(taskId);
  if (!task) throw new HttpError(404, 'Task not found.');

  res.json({ success: true, task });
});

// GET /api/history
export const getHistory = asyncHandler(async (_req: Request, res: Response) => {
  const history = await taskService.getUserHistory(DEMO_USER_ID);
  res.json({ success: true, history });
});

// PATCH /api/item/:itemId  Body: { status: "done" | "pending" }
export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
  const itemId = parsePositiveIntParam(req.params.itemId);
  if (itemId === null) throw new HttpError(400, 'Invalid item id.');

  const { status } = req.body as { status: string };
  const updated = await taskService.setItemStatus(itemId, status);
  if (!updated) throw new HttpError(404, 'Item not found.');

  res.json({ success: true });
});

// DELETE /api/task/:taskId
export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const taskId = parsePositiveIntParam(req.params.taskId);
  if (taskId === null) throw new HttpError(400, 'Invalid task id.');

  const deleted = await taskService.deleteBreakdown(taskId);
  if (!deleted) throw new HttpError(404, 'Task not found.');

  res.json({ success: true });
});
