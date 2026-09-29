-- MirrorSpace — initial Postgres schema (migrated from MongoDB Atlas)
--
-- Run this against your Supabase project once, either via
--   supabase db push
-- or by pasting it into the Supabase Studio SQL editor.
--
-- Security model: every table has RLS enabled with NO permissive policies.
-- That denies all access to the `anon` and `authenticated` keys by default.
-- The Express API reaches Postgres with the `service_role` key, which
-- bypasses RLS, so authorisation is enforced in the API layer for now.
-- When we move to Supabase Auth, per-user policies get added here and the
-- service_role key stops being the only way in.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- `local_id` is the anonymous, device-generated identity the app has always
-- used (local-first: no email, no password). `auth_user_id` is reserved for
-- the upcoming Supabase Auth work, where a user can optionally claim their
-- anonymous account by linking it to auth.users.

create table if not exists public.users (
  id                  uuid primary key default gen_random_uuid(),
  local_id            text not null unique,
  auth_user_id        uuid unique,
  intents             text[] not null default '{}',
  permissions         jsonb  not null default jsonb_build_object(
                        'sleepTracking',   false,
                        'journaling',      false,
                        'chatReflections', false
                      ),
  onboarding_complete boolean not null default false,
  last_active_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint users_intents_valid check (
    intents <@ array[
      'understand_mind',
      'reduce_anxiety',
      'sleep_better',
      'vent_without_judgment'
    ]::text[]
  )
);

create index if not exists users_last_active_at_idx on public.users (last_active_at desc);

-- ---------------------------------------------------------------------------
-- sleep_logs
-- ---------------------------------------------------------------------------

create table if not exists public.sleep_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  date       date not null,
  sleep_time timestamptz not null,
  wake_time  timestamptz not null,
  duration   integer not null, -- minutes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_logs_duration_positive check (duration > 0 and duration <= 1440),
  constraint sleep_logs_wake_after_sleep check (wake_time > sleep_time),
  -- one night, one log: a re-submission for the same date overwrites
  constraint sleep_logs_user_date_unique unique (user_id, date)
);

create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------

create table if not exists public.journal_entries (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users (id) on delete cascade,
  type                    text not null default 'text',
  content                 text not null,
  sentiment               jsonb not null default '{}'::jsonb,
  patterns                jsonb not null default '{}'::jsonb,
  reflection              text,
  reflection_generated_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint journal_entries_type_valid check (type in ('text', 'chaos')),
  constraint journal_entries_content_not_blank check (length(btrim(content)) > 0)
);

create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- insights
-- ---------------------------------------------------------------------------

create table if not exists public.insights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  type       text not null,
  headline   text not null,
  subtext    text,
  based_on   text[] not null default '{}',
  date       timestamptz not null default now(),
  seen       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insights_type_valid check (type in ('daily', 'weekly')),
  constraint insights_based_on_valid check (
    based_on <@ array['sleep', 'journal', 'activity', 'voice', 'chat']::text[]
  )
);

create index if not exists insights_user_type_date_idx
  on public.insights (user_id, type, date desc);

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages
-- ---------------------------------------------------------------------------
-- MongoDB embedded the message array inside the session document. In Postgres
-- the messages get their own table: appending a message is then a single
-- insert instead of a read-modify-write of the whole conversation.

create table if not exists public.chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  context          jsonb not null default '{}'::jsonb,
  session_ended_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists chat_sessions_user_created_idx
  on public.chat_sessions (user_id, created_at desc);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_valid check (role in ('user', 'mirror'))
);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at asc);

-- ---------------------------------------------------------------------------
-- mood_patterns
-- ---------------------------------------------------------------------------

create table if not exists public.mood_patterns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  period_start timestamptz not null,
  period_end   timestamptz not null,
  patterns     jsonb not null default '{}'::jsonb,
  data_points  jsonb not null default '{}'::jsonb,
  ai_insight   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint mood_patterns_period_valid check (period_end >= period_start)
);

create index if not exists mood_patterns_user_period_idx
  on public.mood_patterns (user_id, period_end desc);

-- ---------------------------------------------------------------------------
-- calm_triggers
-- ---------------------------------------------------------------------------
-- The calm-mode route claimed to "log the trigger for pattern analysis" but
-- never stored anything. This is where those events actually land now.

create table if not exists public.calm_triggers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint calm_triggers_source_valid check (
    source in ('manual', 'panic_detected', 'behavior_spike')
  )
);

create index if not exists calm_triggers_user_created_idx
  on public.calm_triggers (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'sleep_logs', 'journal_entries', 'insights',
    'chat_sessions', 'mood_patterns'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — deny by default
-- ---------------------------------------------------------------------------

alter table public.users           enable row level security;
alter table public.sleep_logs      enable row level security;
alter table public.journal_entries enable row level security;
alter table public.insights        enable row level security;
alter table public.chat_sessions   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.mood_patterns   enable row level security;
alter table public.calm_triggers   enable row level security;

-- Belt and braces: the anon/authenticated keys are public in the browser
-- bundle, so revoke the grants PostgREST hands them by default.
revoke all on all tables in schema public from anon, authenticated;
