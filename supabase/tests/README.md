# Local test stack

The auth tests need to mint Supabase-shaped tokens, which means they need a
signing key. Rather than pointing at a real project, they run against a local
stand-in:

- **Postgres** carrying `../migrations/0001_init.sql` and `0002_auth.sql`,
  plus `local_auth_fixture.sql` which recreates the small part of the hosted
  `auth` schema the migrations depend on (`auth.users`, `auth.uid()`).
- **PostgREST** in front of it, which is what `@supabase/supabase-js` talks to
  on a real project.
- **`server/test/shim.mjs`**, which presents the URL shapes a Supabase project
  exposes (it lives under `server/` so that its `jose` import resolves):
  `/rest/v1/*` proxied to PostgREST, `/auth/v1/.well-known/jwks.json` serving
  the public half of a real ES256 keypair, and a small subset of GoTrue
  (`/auth/v1/signup` for anonymous sign-in, `/auth/v1/token`, `/auth/v1/user`,
  `/auth/v1/logout`). The private half of the keypair is written to a keys file
  so the tests can sign tokens exactly as Supabase Auth would.

What this buys: token verification, key rotation, provisioning, the
anonymous-to-permanent upgrade, and the RLS policies are all exercised against
real Postgres and real cryptography, with no Supabase account required.

What it does not cover: GoTrue itself. Magic-link delivery, the OAuth
handshake, and identity linking are Supabase's own code paths and need a real
project to exercise. Run `server/test/api.e2e.mjs` against one with
`SUPABASE_URL` and `SUPABASE_ANON_KEY` set to cover the rest.

## Bringing it up

Roughly:

```bash
# 1. Postgres with the schema
createdb mirrorspace
psql -d mirrorspace -c "create role anon nologin; create role authenticated nologin;
                        create role service_role nologin bypassrls;
                        create role authenticator noinherit login password 'authpass';
                        grant anon, authenticated, service_role to authenticator;"
psql -d mirrorspace -f local_auth_fixture.sql
psql -d mirrorspace -f ../migrations/0001_init.sql
psql -d mirrorspace -f ../migrations/0002_auth.sql

# 2. PostgREST on :3999, with db-anon-role=anon and a jwt-secret of your choosing

# 3. The shim on :4000
cd ../../server && KEYS_OUT=keys.json PSQL="psql -d mirrorspace" node test/shim.mjs

# 4. The API against the shim
SUPABASE_URL=http://127.0.0.1:4000 \
SUPABASE_SERVICE_ROLE_KEY=<a service_role JWT signed with PostgREST's secret> \
SUPABASE_JWKS_COOLDOWN_MS=1000 npm start
```

Then:

```bash
cd server
KEYS_FILE=keys.json PSQL="psql -d mirrorspace" npm run test:auth
KEYS_FILE=keys.json PSQL="psql -d mirrorspace" npm run test:e2e

cd ../client && npm run build && npm run preview &
npm run test:flow
```

## Running the RLS checks by hand

`local_auth_fixture.sql` gives you `auth.uid()`, so policies can be exercised
directly in psql by taking on the `authenticated` role and setting the claims
PostgREST would have set:

```sql
set role authenticated;
set request.jwt.claims = '{"sub":"<an auth.users id>","role":"authenticated"}';
select count(*) from public.journal_entries;   -- only that user's rows
```

Reset with `reset role;`.
