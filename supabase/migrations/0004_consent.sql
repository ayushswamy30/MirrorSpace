-- MirrorSpace — consent records, age gate and AI disclosure
--
-- The mobile onboarding (report §8) asks for each use of data on its own
-- screen, and India's DPDP Rules, GDPR and the US state chatbot laws all
-- expect the app to be able to show what a person agreed to and when. So
-- consent is an append-only log rather than a flag that gets overwritten:
-- granting and withdrawing are both rows, and the current state of a purpose
-- is simply its latest row.
--
-- Run after 0003_harden_functions.sql. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- users: age confirmation and AI disclosure
-- ---------------------------------------------------------------------------
-- 18+ at launch (California SB 243 minor protections). Both are timestamps,
-- not booleans, so the record says when the person saw and confirmed it.

alter table public.users
  add column if not exists age_confirmed_at       timestamptz,
  add column if not exists ai_disclosure_seen_at  timestamptz;

-- ---------------------------------------------------------------------------
-- consent_events
-- ---------------------------------------------------------------------------
--   readings       derived numbers from check-ins and sleep may be used to
--                  write the daily reading
--   ai_reflections text written in Vent and Mirror may be sent, transiently,
--                  to the AI provider to write a reflection
--   health         sleep and body signals may be read from HealthKit /
--                  Health Connect
--
-- policy_version names the wording the person actually saw, so a later change
-- of wording can be told apart from the consent given to the earlier one.

create table if not exists public.consent_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  purpose        text not null,
  granted        boolean not null,
  policy_version text not null,
  created_at     timestamptz not null default now(),
  constraint consent_events_purpose_valid check (
    purpose in ('readings', 'ai_reflections', 'health')
  ),
  constraint consent_events_policy_version_present check (length(btrim(policy_version)) > 0)
);

create index if not exists consent_events_user_purpose_created_idx
  on public.consent_events (user_id, purpose, created_at desc);

alter table public.consent_events enable row level security;

-- A person can read their own consent history. Writes go through the API, so
-- the log cannot be edited or back-dated from a client.
drop policy if exists consent_events_select_own on public.consent_events;
create policy consent_events_select_own on public.consent_events
  for select to authenticated
  using (user_id = private.current_app_user_id());

grant select on public.consent_events to authenticated;
revoke all on public.consent_events from anon;
