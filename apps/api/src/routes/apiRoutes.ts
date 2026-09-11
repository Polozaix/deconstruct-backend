import { Router } from 'express';
import { DeconstructRequestSchema, UpdateItemStatusSchema } from '@deconstruct/shared';
import {
  deleteTask,
  getHistory,
  getTask,
  handleDeconstruct,
  updateItemStatus,
} from '../controllers/aiController';
import { aiLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';

const router = Router();

// Core flow: problem -> smaller problems -> routine
router.post('/deconstruct', aiLimiter, validateBody(DeconstructRequestSchema), handleDeconstruct);

// Retrieve breakdowns
router.get('/task/:taskId', getTask);
router.get('/history', getHistory);

// Update a single step (mark done / pending)
router.patch('/item/:itemId', validateBody(UpdateItemStatusSchema), updateItemStatus);

// Remove a breakdown and its steps
router.delete('/task/:taskId', deleteTask);

export default router;
