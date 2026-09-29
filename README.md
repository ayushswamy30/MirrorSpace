# MirrorSpace

A quiet, local-first mental-health companion. Log sleep, vent into a journal,
talk to the Mirror, and get pattern-based reflections — no scores, no
diagnoses.

- `client/` — React 19 + Vite front end
- `server/` — Express 5 API
- `supabase/migrations/` — Postgres schema

## Accounts

MirrorSpace is **anonymous-first**. Opening the app signs you in
anonymously through Supabase Auth — no email, no password, no signup wall —
and every feature works from that first second.

Attaching an identity later is optional and lives at `/account`. Because
Supabase keeps the same user id through the upgrade, nothing is migrated and
nothing is lost: the journals, sleep logs and conversations written
anonymously simply belong to a permanent account afterwards.

- **Magic link** — enter an email, click the link. No password to store, reset
  or leak.
- **Google** — one tap.

Both are offered in two shapes, which are not the same operation:

| | What it does |
| --- | --- |
| *Save your space* | Attaches an identity to the account you're already using (`updateUser` / `linkIdentity`). Your data comes with you. |
| *Find your space* | Signs in to an account that already exists, on a new device (`signInWithOtp` / `signInWithOAuth`). Replaces the current anonymous session. |

Signing out returns you to a fresh anonymous space rather than a locked door.

## Data layer

The API stores everything in **Supabase Postgres**, reached with
`@supabase/supabase-js`.

Tables: `users`, `sleep_logs`, `journal_entries`, `insights`,
`chat_sessions`, `chat_messages`, `mood_patterns`, `calm_triggers`.
Deleting a user cascades to all of their rows, and `public.users.auth_user_id`
cascades from `auth.users` — so deleting the auth identity erases everything.

## Privacy

Two things every account can do, anonymous ones included — an anonymous space
still holds real writing, and its owner is still entitled to take it or
destroy it:

- **Export** (`GET /api/user/export`) returns everything as one JSON file:
  entries, sleep logs, whole conversations, generated insights, *and* the
  sentiment analysis the app never surfaces in the UI. An export that hid the
  inferences would be a worse answer to "what do you know about me" than
  saying nothing.
- **Erase** (`DELETE /api/user`) deletes the Supabase Auth identity. Because
  `public.users` cascades from `auth.users` and every other table cascades
  from `public.users`, that one delete removes everything, with nothing
  orphaned. The UI requires typing `delete everything` first; there is no
  undo.

Both are capped at 5 requests an hour.

## How authorisation works

Three layers, deliberately:

0. **Security headers.** `helmet` sets HSTS (production only), `nosniff`,
   `no-referrer`, and a content policy of `default-src 'none'` — this process
   only ever answers JSON, so nothing needs to be allowed.
1. **The API verifies every token itself.** Supabase Auth signs access tokens;
   the API verifies them locally against the project's JWKS (asymmetric keys)
   or the legacy HMAC secret, checking issuer, audience, expiry and role. No
   round trip to the Auth server on a request.
2. **Every query is scoped by user.** The API holds the `service_role` key,
   which bypasses RLS, so each repository query filters on `user_id`
   explicitly. Chat sessions are looked up by `(id, user_id)`, never by id
   alone.
3. **The database enforces it too.** Every table has RLS on, with per-user
   policies keyed to `auth.uid()`. The public `anon` key is granted nothing at
   all, so it cannot read or write anything even with a valid session absent.

The `service_role` key never leaves the server. The `anon` key is in the
browser bundle by design — it is useless without a session, and a session only
ever sees its own rows.

## Setup

### 1. Create the Supabase project and schema

Create a project at [supabase.com](https://supabase.com), then apply the
migrations in order — either with the CLI:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

or by pasting `0001_init.sql`, `0002_auth.sql` and `0003_harden_functions.sql`
from `supabase/migrations/` into the SQL editor in Supabase Studio, in that
order. All three are idempotent, so re-running them is safe.

Afterwards, Supabase's own database linter (Advisors → Security in the
dashboard) should report nothing; `0003` exists to keep it that way.

Do **not** run anything from `supabase/tests/` against a real project — that
directory recreates parts of the hosted `auth` schema for local testing.

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
| `SUPABASE_JWT_SECRET` | Only if the project still uses the legacy shared HMAC secret. Projects on JWT signing keys need nothing |
| `CORS_ORIGINS` | Comma-separated browser origins, e.g. the Vite dev URL |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Optional — see below |

The server validates all of these at boot and refuses to start if a required
one is missing, rather than failing later one request at a time.

The `service_role` key bypasses RLS. Keep it on the server; it must never
reach the browser bundle.

### 3. Turn on the auth providers

In the Supabase dashboard:

- **Authentication → Providers → Anonymous sign-ins**: enable. Without this
  the app cannot open at all, since every visitor starts anonymous.
- **Authentication → Providers → Email**: enable, and leave "Confirm email" on
  — that is what makes the magic link a magic link.
- **Authentication → Providers → Google**: enable and paste in a Google Cloud
  OAuth client id and secret.
- **Authentication → Manual linking**: enable. `linkIdentity` needs it, and
  without it upgrading an anonymous account with Google fails.
- **Authentication → URL Configuration → Redirect URLs**: add
  `http://localhost:5173/auth/callback` and the deployed equivalent.

### 4. Configure the client

```bash
cd client
cp .env.example .env.local
npm install
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings →
API Keys → `anon` / publishable). This key is public by design; the
`service_role` key must never go here.

### 5. Run

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
API_BASE_URL=http://localhost:5000/api \
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:e2e
```

Exercises every endpoint against a running server — validation, pagination,
and cross-user isolation — signing in anonymously for its sessions. It writes
real rows, so point it at a development project rather than production.

`npm run test:auth` covers token verification, key rotation, provisioning and
the anonymous-to-permanent upgrade. `client`'s `npm run test:flow` drives a
real Chromium through first run, onboarding, the account page and a reload,
checking what actually reached the database — the kind of thing that catches a
bundle which builds but renders nothing.

Both need to mint tokens, so they run against a local stand-in rather than a
real project; [`supabase/tests/README.md`](supabase/tests/README.md) has the
setup.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/user/profile` | Provisions the app user on first call |
| `GET` | `/api/user/export` | Everything this account holds, as JSON |
| `DELETE` | `/api/user` | Erases the account and all of it, permanently |
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

Every route except `/api/health` needs `Authorization: Bearer <token>`,
where the token is a Supabase Auth access token. There is no sign-in endpoint
here — Supabase Auth issues sessions, and this API only verifies them.

Rate limits: 300 requests / 15 min per IP across the API, then per-user
ceilings on the paths that cost money or cannot be undone — 60 chat messages /
15 min, 10 predictions / hour, 120 writes / 15 min, 5 export-or-delete /
hour.

## Deployment (Vercel)

The whole app deploys as **one origin**: the Vite build is served statically
and the Express API runs as a serverless function at `/api/*`. Same origin
means the browser never makes a cross-origin request, so CORS stops being
part of the production picture entirely.

```
vercel.json      routing, SPA fallback, and the front end's CSP
package.json     root: the API's runtime deps + the client build command
api/index.js     the serverless entrypoint — an Express app is already a handler
server/app.js    the app, with no listener attached
server/server.js binds a port; used for local dev, not on Vercel
```

`server/app.js` and `server/server.js` are split precisely because a
serverless handler is given a request, not a port to bind.

### Environment variables to set in Vercel

The build bakes in the two public values; the rest are read at runtime by the
function. Set these under Project → Settings → Environment Variables:

| Variable | Why |
| --- | --- |
| `SUPABASE_URL` | Runtime, for the function |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Bypasses RLS — server only, never in the client |
| `VITE_SUPABASE_URL` | Build-time, baked into the bundle |
| `VITE_SUPABASE_ANON_KEY` | Build-time, public by design |
| `VITE_API_URL` | `/api` — same origin |
| `CORS_ORIGINS` | Only needed if the front end is ever served from another origin |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Optional |

Then add the deployment's URL to Supabase → Authentication → URL
Configuration → Redirect URLs as `https://<your-domain>/auth/callback`, or
magic links and Google will bounce.

### A caveat worth knowing

Rate limiting uses an in-memory store, which on serverless is **per instance**
rather than global. Limits still apply and still bound abuse, but a determined
caller spread across cold starts gets more than the nominal ceiling. Two ways
to make them exact: run the API on a single long-lived host instead, or back
`express-rate-limit` with a shared store. This does not affect authorisation —
tokens, per-user query scoping, and RLS are unaffected.

## Where this is going

Done: Supabase Postgres, schema and migrations, Supabase Auth with
anonymous-first accounts, local JWT verification with key rotation, per-user
RLS policies, per-user rate limiting, security headers, data export and
account erasure, validated config, CORS allowlist.

Next: a shared rate-limit store so the ceilings are exact on serverless, and
connecting the GitHub repo to Vercel so pushes deploy themselves.
