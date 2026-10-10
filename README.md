# Lowkei

A private journal and mood tracker. Check in, vent, talk to the Mirror, and
see the weather of your weeks — what you write stays on your phone.

| Folder | What it is | Runs on |
| --- | --- | --- |
| [`mobile/`](mobile/README.md) | The app (Expo, TypeScript): Android, and the browser build that is the iPhone version | EAS builds; the site at `/app` |
| `server/` | The API (Express 5): accounts, consents, Circle, the Mirror, the legal pages | Render — `mirrorspace-api.onrender.com` |
| [`site/`](site/README.md) | The public site, static HTML built by a script | Vercel — `getlowkei.vercel.app` |
| `supabase/` | Postgres migrations, the code-email templates and their setup script | Supabase |
| `design/` | The pictures the app and site use, and the prompts they were made from | — |

*MirrorSpace New Direction Report.docx* is the product brief.

## Accounts

An account is required, made with an email: the person types the address,
then a six-digit code sent to it — no passwords. Supabase Auth sends the codes
through Brevo; `supabase/configure-auth-email.mjs` sets that up (SMTP, the
templates in `supabase/email-templates/`, six-digit codes).

What someone writes — check-ins, pages, the Mirror conversation — is kept on
their phone (SQLCipher on Android; the browser's private storage on iPhone),
not on the server. The server holds the account, consents and what Circle
shares.

## Data and privacy

- **Supabase Postgres**, reached by the API with the `service_role` key. Every
  query is scoped to the caller's user, and every table also has RLS keyed to
  `auth.uid()`; the public key is granted nothing.
- **Tokens** are Supabase access tokens, verified by the API itself against
  the project's JWKS — no round trip per request.
- **Export** (`GET /api/user/export`) returns everything the account holds,
  including tables only the earlier web client wrote to.
- **Erase** (`DELETE /api/user`) deletes the Supabase Auth identity; every
  table cascades from it.
- The privacy policy and terms live in `server/legal/` and are served by both
  the API (`/privacy`, `/terms`) and the site.

## The API

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/user/profile` | Provisions the app user on first call |
| `PUT` | `/api/user/onboarding` | Intents, age confirmation, AI disclosure, first consents |
| `PUT` | `/api/user/consents` | Grant or withdraw; appended to the consent log |
| `PUT` / `DELETE` | `/api/user/push-token` | This phone's Expo push token |
| `GET` | `/api/user/export` | Everything the account holds |
| `DELETE` | `/api/user` | Erases the account |
| | `/api/circle/…` | Names, invites, friends, weather, nudges |
| `GET` | `/api/mirror/status` | Whether the Mirror can answer this person |
| `POST` | `/api/mirror/reply`, `/api/mirror/reflect` | AI replies; nothing is stored |
| `GET` | `/api/health` | Whether Supabase is reachable |

Everything except health and the legal pages needs `Authorization: Bearer
<token>`. Rate limits: 300 requests / 15 min per IP, then per-user ceilings on
chat, writes, and export or erase.

AI replies go to Groq (Gemini's unpaid tier never sees personal text; see
`server/lib/aiProviders.js`).

## Setup

1. **Database**: apply `supabase/migrations/` in order (`supabase db push`, or
   paste them into the SQL editor). They are idempotent. Never run
   `supabase/tests/` against a real project.
2. **API**: `cd server && cp .env.example .env && npm install`, fill in
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS` (the site's
   origin, for the web app) and `GROQ_API_KEY`, then `npm run dev`
   (port 5000). The server refuses to start without the required values.
3. **Email**: run `supabase/configure-auth-email.mjs` with a Supabase access
   token and a Brevo SMTP login and key.
4. **App and site**: see [`mobile/README.md`](mobile/README.md) and
   [`site/README.md`](site/README.md).

Render deploys the API from `main`; the site deploys with `sh site/deploy.sh`.

## Tests

```bash
cd server
npm run test:unit      # pure logic
npm run test:schema    # every migration on in-process Postgres, twice; RLS and grants
npm run test:e2e       # against a running server and a development project
npm run test:auth      # token verification and key rotation, on a local stand-in
```

`supabase/tests/README.md` has the local stand-in for the last two. The app's
own checks are in `mobile/README.md`.
