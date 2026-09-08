const { GoogleGenAI } = require('@google/genai');

// Initialize the Google Gen AI client (key comes from .env)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Ask Gemini to deconstruct a problem into an ordered list of smaller,
 * actionable sub-problems.
 *
 * @param {string} problemText - The problem/assignment from the user
 * @param {string|null} dueDate - Optional deadline (YYYY-MM-DD)
 * @returns {Promise<Array<{title: string, description: string, durationMinutes: number}>>}
 */
async function deconstructProblem(problemText, dueDate) {
    const deadlineLine = dueDate
        ? `The deadline is: "${dueDate}".`
        : 'There is no hard deadline.';

    const prompt = `You are an expert project manager.
The user needs to solve this problem: "${problemText}".
${deadlineLine}
Deconstruct it into a chronological, ordered list of smaller, actionable sub-problems.
Each sub-problem should be a concrete step that takes between 15 and 60 minutes.
Keep the list short and practical (between 3 and 10 steps).`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        title: { type: 'STRING', description: 'Short, actionable name of the sub-problem' },
                        description: { type: 'STRING', description: 'One sentence explaining what to do' },
                        durationMinutes: { type: 'INTEGER', description: 'Estimated minutes to complete (15-60)' }
                    },
                    required: ['title', 'description', 'durationMinutes']
                }
            }
        }
    });

    return JSON.parse(response.text);
}

module.exports = { deconstructProblem };