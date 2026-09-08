# Deconstruct.ai

Give it a problem. It breaks it into smaller, actionable sub-problems with AI and builds a day-by-day routine to solve it.

## How It Works

1. **Input**: The user submits a problem (optionally a deadline and daily time budget)
2. **Breakdown**: Gemini AI deconstructs it into ordered, bite-sized sub-problems
3. **Routine**: A greedy scheduler assigns every step a day and start time based on the daily time budget
4. **Track**: Steps are stored in SQLite; each can be marked done/pending

## Project Structure

```
deconstruct-backend/
├── server.js                  # Express app entry point
├── controllers/
│   └── aiController.js        # Request handlers
├── routes/
│   └── apiRoutes.js           # API endpoints
├── services/
│   ├── geminiService.js       # Gemini AI integration (breakdown)
│   ├── routineService.js      # Day/time routine builder
│   ├── taskService.js         # Orchestration (AI -> routine -> DB)
│   └── databaseService.js     # SQLite persistence
├── views/
│   └── index.html             # Single-page frontend
└── data/
    └── deconstruct.db         # SQLite database (auto-created)
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/deconstruct` | Break a problem into sub-problems + routine. Body: `{ problem, dueDate?, dailyMinutes? }` |
| GET | `/api/task/:taskId` | Get a breakdown with its steps |
| GET | `/api/history` | Get all past breakdowns |
| PATCH | `/api/item/:itemId` | Mark a step done/pending. Body: `{ status: "done" \| "pending" }` |
| DELETE | `/api/task/:taskId` | Delete a breakdown and its steps |

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up `.env`:
```
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

3. Start the server:
```bash
npm start
```

4. Open http://localhost:3000, type a problem, and hit **Break It Down**.

## Example

```bash
curl -X POST http://localhost:3000/api/deconstruct \
  -H "Content-Type: application/json" \
  -d '{"problem": "Write a 10-page research paper on renewable energy", "dailyMinutes": 60}'
```

Response includes the ordered steps with per-day routine assignments (`assignedDay`, `startTime`), total time, and whether the plan fits the deadline.

## Technologies

- Node.js + Express
- Google Gemini AI (`gemini-3.6-flash`) with strict JSON schema output
- SQLite (`sqlite3`) for persistence
- Vanilla HTML/JS frontend

## Future Enhancements

- User authentication (currently single demo user)
- Google Calendar integration
- Recurring schedules and work-day awareness
- Frontend web app (React)