-- TEST FIXTURE — do not run against a real Supabase project.
--
-- Hosted Supabase already provides the `auth` schema, `auth.users`, and
-- `auth.uid()`. This file recreates just enough of them on a plain Postgres
-- instance so the migrations in ../migrations can be applied and exercised
-- locally (see README: "Verifying the schema locally").

create schema if not exists auth;

create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Matches the hosted implementation: read `sub` out of the JWT claims that
-- PostgREST puts on the connection for the current request.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
