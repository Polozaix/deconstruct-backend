const taskService = require('../services/taskService');

// POST /api/deconstruct
// Body: { problem: string, dueDate?: "YYYY-MM-DD", dailyMinutes?: number }
async function handleDeconstruct(req, res) {
    try {
        const { problem, dueDate, dailyMinutes } = req.body;

        if (!problem || typeof problem !== 'string' || problem.trim().length < 3) {
            return res.status(400).json({ error: 'Please provide a problem description (at least 3 characters).' });
        }

        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            return res.status(400).json({ error: 'dueDate must be in YYYY-MM-DD format.' });
        }

        let minutes = parseInt(dailyMinutes, 10);
        if (Number.isNaN(minutes)) minutes = 60;
        minutes = Math.min(Math.max(minutes, 15), 480);

        console.log('Deconstructing problem with AI...');
        const result = await taskService.processProblem(problem.trim(), dueDate || null, minutes);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error in deconstruct API:', error);
        res.status(500).json({ error: 'Failed to deconstruct the problem. Please try again.' });
    }
}

// GET /api/task/:taskId
async function getTask(req, res) {
    try {
        const task = await taskService.getTaskBreakdown(req.params.taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }
        res.json({ success: true, task });
    } catch (error) {
        console.error('Error getting task:', error);
        res.status(500).json({ error: 'Failed to retrieve task.' });
    }
}

// GET /api/history
async function getHistory(req, res) {
    try {
        const history = await taskService.getUserHistory('demo_user');
        res.json({ success: true, history });
    } catch (error) {
        console.error('Error getting history:', error);
        res.status(500).json({ error: 'Failed to retrieve history.' });
    }
}

// PATCH /api/item/:itemId  Body: { status: "done" | "pending" }
async function updateItemStatus(req, res) {
    try {
        const { status } = req.body;
        if (!['done', 'pending'].includes(status)) {
            return res.status(400).json({ error: "status must be 'done' or 'pending'." });
        }

        const ok = await taskService.setItemStatus(req.params.itemId, status);
        if (!ok) {
            return res.status(404).json({ error: 'Item not found.' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item.' });
    }
}

// DELETE /api/task/:taskId
async function deleteTask(req, res) {
    try {
        const deleted = await taskService.deleteBreakdown(req.params.taskId);
        if (!deleted) {
            return res.status(404).json({ error: 'Task not found.' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
}

module.exports = { handleDeconstruct, getTask, getHistory, updateItemStatus, deleteTask };