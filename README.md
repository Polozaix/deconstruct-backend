# Deconstruct.ai

  Give it a problem. It breaks it into smaller, actionable steps with AI, then builds a
  day-by-day routine you can actually follow.

  The core idea: **the LLM only reasons — it never does scheduling arithmetic.** Gemini
  decomposes the problem and estimates effort; a deterministic, unit-tested scheduler
  (`packages/scheduler`) turns that into concrete day/time assignments. This is what makes
  it a product rather than a thin AI wrapper.

  ## Architecture

  ```
  deconstruct/
├─ apps/
│  └─ api/                      # Express 5 API (TypeScript)
│     ├─ prisma/
│     │  ├─ schema.prisma       # PostgreSQL schema
│     │  └─ migrations/         # SQL migrations (applied on deploy)
│     ├─ public/index.html      # Current frontend (React SPA lands in Phase 5)
│     └─ src/
│        ├─ env.ts              # Zod-validated environment (fails fast)
│        ├─ app.ts              # Express app (also exported for tests)
│        ├─ index.ts            # Bootstrap + graceful shutdown
│        ├─ middleware/         # requestId, error handler, validation, rate limits
│        ├─ routes/             # /api routes
│        ├─ controllers/        # Thin HTTP handlers
│        ├─ services/           # AI orchestration + business logic
│        └─ repos/              # Prisma data access
├─ packages/
│  ├─ scheduler/                # ⭐ Pure deterministic scheduling engine (tested)
│  └─ shared/                   # Zod schemas + shared types
├─ Dockerfile                   # Multi-stage build (used by Render)
├─ render.yaml                  # Render Blueprint (web service + Postgres)
├─ docker-compose.yml           # Local Postgres for development
└─ .github/workflows/ci.yml     # Lint-less CI: build + typecheck + test
```

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start a local database**

   ```bash
   docker compose up -d
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Then set `GEMINI_API_KEY` (from Google AI Studio) and leave `DATABASE_URL` pointing at
   the compose database.

4. **Create the schema**

   ```bash
   npm run prisma:deploy     # applies migrations
   ```

5. **Run it**

   ```bash
   npm run dev               # API on http://localhost:3000
   ```

   Open <http://localhost:3000>, type a problem, and hit **Break It Down**.

### Useful commands

| Command | What it does |
|---|---|
| `npm run build` | Compile `shared` → `scheduler` → `api` (in dependency order) |
| `npm run dev` | Watch mode API |
| `npm test` | Unit tests for the scheduler + API |
| `npm run typecheck` | Type-check without emitting |
| `npm run prisma:migrate` | Create/apply a migration in development |
| `npm run prisma:deploy` | Apply existing migrations (used on deploy) |

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/deconstruct` | Break a problem into steps + routine. Body: `{ problem, dueDate?, dailyMinutes? }` |
| `GET` | `/api/task/:taskId` | Get a breakdown with its steps |
| `GET` | `/api/history` | List past breakdowns |
| `PATCH` | `/api/item/:itemId` | Mark a step `done` / `pending` |
| `DELETE` | `/api/task/:taskId` | Delete a breakdown and its steps |
| `GET` | `/health` | Liveness probe |
| `GET` | `/ready` | Readiness probe (checks the database) |

`dailyMinutes` is a number (15–480) for the max work per day, or `"same"`/`0` to do it all
in one day.

## Choosing an AI provider

The LLM is isolated behind `apps/api/src/services/ai/`, so the provider is a configuration
choice rather than a code change. Set `AI_PROVIDER`:

| `AI_PROVIDER` | Transport | Notes |
|---|---|---|
| `gemini` *(default)* | Native `@google/genai` | Uses a strict `responseSchema`, so the JSON shape is guaranteed by the API |
| `openrouter` | OpenAI-compatible | Routes to any model OpenRouter serves. The same code also drives OpenAI, Groq, Together, or a local Ollama — just change `OPENROUTER_BASE_URL` |

```bash
# Switch to OpenRouter
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.5-flash
```

Because OpenRouter fronts models with varying structured-output support, the model response
is always validated against `AiPlanSchema` (Zod) and **retried once** before it can reach the
scheduler — a malformed plan can never corrupt a routine. Adding a provider means implementing
one small `AiProvider` interface.

## Deploying to Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml`, which
   provisions a Postgres database and a Docker web service.
3. Set the secret env vars in the service settings: **`GEMINI_API_KEY`** (required).
   `DATABASE_URL` and `SESSION_SECRET` are wired up automatically.
4. Deploy. `npm run prisma:deploy -w @deconstruct/api` runs as the pre-deploy command, then
   the server starts and is checked at `/health` and `/ready`.

## Security notes

- `.env` is git-ignored. Only `.env.example` is committed.
- The original prototype committed a live Gemini API key. **Rotate it** in Google AI
  Studio / Cloud console regardless of repository visibility.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo hygiene, gitignore, untrack secrets/`node_modules` | ✅ done |
| 1 | Monorepo, TypeScript API, Postgres/Prisma, Docker + Render, CI, tests | ✅ done |
| 2 | Real calendar-aware scheduler (availability windows, dependencies, critical path) | ⏭ next |
| 3 | Google Calendar two-way sync (OAuth, free/busy, event push, webhooks) | ⏭ |
| 4 | Adaptive replanning (snooze / skip / split / drop / re-plan remaining) | ⏭ |
| 5 | Notion-style React frontend (drag-to-reschedule, calendar view, command palette) | ⏭ |
| 6 | Launch hardening (cost caps, Sentry, privacy policy, OAuth verification) | ⏭ |

## Tech

Node.js + Express 5 · TypeScript · Prisma + PostgreSQL · pluggable AI
(Google Gemini via `@google/genai`, or OpenRouter / any OpenAI-compatible model) · Zod ·
Pino · Vitest · Docker


## How It Works

1. **Input**: The user submits a problem (optionally a deadline and daily time budget)
2. **Breakdown**: Gemini AI deconstructs it into phases, each with ordered, actionable tasks. The plan scales with the problem's real scope — "cook dinner" gets 1 phase with a few tasks; "make a professional game" gets many phases with dozens of tasks
3. **Routine**: A greedy scheduler assigns every task a day and start time based on the daily time budget (`dailyMinutes: 0` = do it all in one day)
4. **Track**: Tasks are stored in SQLite with their phase; each can be marked done/pending

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
| POST | `/api/deconstruct` | Break a problem into sub-problems + routine. Body: `{ problem, dueDate?, dailyMinutes? }` where `dailyMinutes` is a number (15-480, max work per day), `0`/`"same"` = do it all today, or omitted = same day |
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