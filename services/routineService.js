/**
 * Routine builder - turns an ordered list of steps into a simple day-by-day
 * plan. This is the basic greedy version: fill each day up to dailyMinutes
 * starting at 9:00 AM, then move to the next day.
 */
const DAY_START_HOUR = 9;

function formatDate(date) {
    // Local date as YYYY-MM-DD (avoids UTC timezone shifting the day)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * @param {Array<{title: string, description: string, durationMinutes: number}>} steps
 * @param {object} options
 * @param {number} options.dailyMinutes - Max minutes of work per day (default 60)
 * @param {string|null} options.dueDate - Optional deadline (YYYY-MM-DD)
 * @returns {{ days: Array, totalMinutes: number, daysNeeded: number, fitsDeadline: boolean|null }}
 */
function buildRoutine(steps, { dailyMinutes = 60, dueDate = null } = {}) {
    const days = [];
    let totalMinutes = 0;

    let dayIndex = 0;
    let minutesUsedToday = 0;
    let clockMinutes = DAY_START_HOUR * 60;
    let currentDay = null;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    steps.forEach((step, index) => {
        const duration = Math.min(Math.max(parseInt(step.durationMinutes, 10) || 30, 5), 240);

        // Not enough room left today -> start a new day
        if (!currentDay || minutesUsedToday + duration > dailyMinutes) {
            dayIndex += 1;
            minutesUsedToday = 0;
            clockMinutes = DAY_START_HOUR * 60;

            const date = new Date(start);
            date.setDate(start.getDate() + (dayIndex - 1));

            currentDay = {
                day: dayIndex,
                date: formatDate(date),
                steps: []
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
            title: step.title,
            description: step.description || '',
            durationMinutes: duration,
            assignedDay: currentDay.date,
            startTime
        });
    });

    // Basic deadline check
    let fitsDeadline = null;
    if (dueDate && days.length > 0) {
        const due = new Date(`${dueDate}T23:59:59`);
        const lastDay = new Date(`${days[days.length - 1].date}T23:59:59`);
        fitsDeadline = lastDay <= due;
    }

    return {
        days,
        totalMinutes,
        daysNeeded: days.length,
        fitsDeadline
    };
}

module.exports = { buildRoutine };