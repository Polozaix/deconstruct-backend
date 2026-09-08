const databaseService = require('./databaseService');
const { deconstructProblem } = require('./geminiService');
const { buildRoutine } = require('./routineService');

const DEMO_USER_ID = 'demo_user'; // Single-user mode for now (no auth yet)

const taskService = {
    /**
     * Full pipeline: problem -> smaller problems -> routine -> database.
     * @param {string} problemText
     * @param {string|null} dueDate - optional YYYY-MM-DD deadline
     * @param {number} dailyMinutes - max minutes of work per day
     */
    processProblem: async function(problemText, dueDate = null, dailyMinutes = 60) {
        // 1. Ask the AI to break the problem into smaller ones
        const rawSteps = await deconstructProblem(problemText, dueDate);

        // 2. Build the routine (day + start time for every step)
        const routine = buildRoutine(rawSteps, { dailyMinutes, dueDate });

        // 3. Flatten routine-assigned steps and persist everything
        const steps = routine.days.flatMap(day => day.steps);

        const taskId = await databaseService.saveBreakdown(DEMO_USER_ID, problemText, dueDate, dailyMinutes);
        const itemIds = await databaseService.saveTaskItems(taskId, steps);

        // Attach database ids to the steps so the UI can update them later.
        // The flat steps array shares object references with routine.days.
        steps.forEach((step, i) => {
            if (itemIds[i]) step.itemId = itemIds[i];
        });

        // 4. Return the full result to the caller
        return {
            taskId,
            problem: problemText,
            dueDate,
            dailyMinutes,
            steps,
            routine: {
                days: routine.days,
                totalMinutes: routine.totalMinutes,
                daysNeeded: routine.daysNeeded,
                fitsDeadline: routine.fitsDeadline
            }
        };
    },

    // Get a breakdown with its steps
    getTaskBreakdown: async function(taskId) {
        const breakdown = await databaseService.getBreakdown(taskId);
        if (!breakdown) return null;

        const items = await databaseService.getTaskItems(taskId);
        return { ...breakdown, steps: items };
    },

    // Get the user's history with steps included
    getUserHistory: async function(userId) {
        const breakdowns = await databaseService.getBreakdowns(userId);

        const enriched = [];
        for (const breakdown of breakdowns) {
            const items = await databaseService.getTaskItems(breakdown.id);
            enriched.push({ ...breakdown, steps: items });
        }
        return enriched;
    },

    // Mark a step done or pending
    setItemStatus: async function(itemId, status) {
        const changes = await databaseService.updateItemStatus(itemId, status);
        if (changes === 0) return false;
        return true;
    },

    // Remove a breakdown and its steps
    deleteBreakdown: async function(taskId) {
        const changes = await databaseService.deleteBreakdown(taskId);
        return changes > 0;
    }
};

module.exports = taskService;