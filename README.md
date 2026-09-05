# MirrorSpace

A quiet, local-first mental-health companion. Log sleep, vent into a journal,
talk to the Mirror, and get pattern-based reflections — no scores, no
diagnoses.

- `client/` — React 19 + Vite front end
- `server/` — Express 5 API
- `supabase/migrations/` — Postgres schema

## Data layer

The API stores everything in **Supabase Postgres**. It reaches the database
with `@supabase/supabase-js` using the **service role** key, so the app's own
authorisation happens in the API layer: every query filters on `user_id`, and
every table has Row Level Security enabled with **no permissive policies**, so
the public `anon` key cannot read or write anything.

Tables: `users`, `sleep_logs`, `journal_entries`, `insights`,
`chat_sessions`, `chat_messages`, `mood_patterns`, `calm_triggers`.
Deleting a user cascades to all of their rows.

## Setup

### 1. Create the Supabase project and schema

Create a project at [supabase.com](https://supabase.com), then apply the
migration — either with the CLI:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

or by pasting `supabase/migrations/0001_init.sql` into the SQL editor in
Supabase Studio. The migration is idempotent, so re-running it is safe.

### 2. Configure the API

```bash
cd server
cp .env.example .env
npm install
```

Fill in `.env`:

| Variable | Where it comes from |
| --- | --- |
| `SUPABASE_URL` | Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role` |
| `JWT_SECRET` | Your own; `openssl rand -base64 48`. Min 32 chars |
| `CORS_ORIGINS` | Comma-separated browser origins, e.g. the Vite dev URL |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Optional — see below |

The server validates all of these at boot and refuses to start if a required
one is missing, rather than failing later one request at a time.

The `service_role` key bypasses RLS. Keep it on the server; it must never
reach the browser bundle.

### 3. Configure the client

```bash
cd client
cp .env.example .env.local
npm install
```

### 4. Run

```bash
cd server && npm run dev    # http://localhost:5000
cd client && npm run dev    # http://localhost:5173
```

`GET /api/health` reports whether Supabase is actually reachable — it returns
503, not 200, when the database is down or the schema was never applied.

## AI providers

Reflections, daily insights and predictions try Groq
(`llama-3.3-70b-versatile`) first, then OpenAI (`gpt-4o-mini`). With neither
key configured every one of those endpoints still answers, using built-in
fallback text — the app is fully usable without an AI key.

## Tests

```bash
cd server
API_BASE_URL=http://localhost:5000/api npm run test:e2e
```

Exercises every endpoint against a running server: auth, validation,
pagination, and cross-user isolation. It writes real rows, so point it at a
development project rather than production.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/init` | Anonymous sign-in; returns a session JWT |
| `GET` | `/api/user/profile` | |
| `PUT` | `/api/user/onboarding` | Intents + permissions |
| `POST` | `/api/sleep` | One log per night; re-posting a date corrects it |
| `GET` | `/api/sleep?range=week\|month\|year\|all` | Oldest first, for the chart |
| `GET` | `/api/sleep/trends?days=7` | Averages, sleep debt, bedtime drift |
| `POST` | `/api/journal` | Sentiment analysis runs silently, never returned |
| `GET` | `/api/journal?limit=&page=` | |
| `POST` | `/api/chat/message` | Reflective chat; omit `sessionId` to start one |
| `GET` | `/api/chat/history` | Last 10 sessions with their messages |
| `GET` | `/api/insights/today` | Generated once per day |
| `GET` | `/api/insights/weekly` | |
| `GET` | `/api/patterns` | Latest predictions |
| `POST` | `/api/patterns/predict` | Runs the prediction engine |
| `POST` | `/api/calm/trigger` | Records a calm-mode opening |
| `GET` | `/api/health` | |

All routes except `/api/auth/init` and `/api/health` need
`Authorization: Bearer <token>`.

## Where this is going

Done: Supabase Postgres, schema + RLS, validated config, CORS allowlist,
per-user query scoping.

Next: Supabase Auth so an anonymous account can be claimed with a real
identity (`users.auth_user_id` is already reserved for it), per-user RLS
policies so the service role stops being the only way in, rate limiting and
security headers, an export/delete-my-data flow, and deployment.
