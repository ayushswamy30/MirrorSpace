-- MirrorSpace — Circle: a few friends who can see your weather, nothing else
--
-- Report §4–5 (Circle: friends, rhythm compatibility, the low-battery
-- signal). What a person shares is deliberately tiny: today's Inner Weather
-- word, whether they are "running low", and one number per weekday for how
-- their days tend to go. Never words, notes, pages or Mirror. It is shared
-- only after the `circle` consent, and withdrawing that consent removes it.
--
-- Everything is written by the API with the service role; the policies below
-- only govern direct `authenticated` access, which the app does not use.
--
-- Run after 0004_consent.sql. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- users: the name friends see, and the code they add you by
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists circle_name text,
  add column if not exists circle_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_circle_name_valid') then
    alter table public.users add constraint users_circle_name_valid
      check (circle_name is null or char_length(btrim(circle_name)) between 1 and 24);
  end if;
  -- Six characters from an alphabet with no 0/O or 1/I, easy to read aloud.
  if not exists (select 1 from pg_constraint where conname = 'users_circle_code_valid') then
    alter table public.users add constraint users_circle_code_valid
      check (circle_code is null or circle_code ~ '^[A-HJ-NP-Z2-9]{6}$');
  end if;
end $$;

create unique index if not exists users_circle_code_key on public.users (circle_code);

-- ---------------------------------------------------------------------------
-- consent: `circle` joins the purposes
-- ---------------------------------------------------------------------------

alter table public.consent_events drop constraint if exists consent_events_purpose_valid;
alter table public.consent_events add constraint consent_events_purpose_valid check (
  purpose in ('readings', 'ai_reflections', 'health', 'circle')
);

-- ---------------------------------------------------------------------------
-- friendships: a request, then (maybe) an acceptance. One row per pair.
-- ---------------------------------------------------------------------------

create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.users (id) on delete cascade,
  addressee_id  uuid not null references public.users (id) on delete cascade,
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint friendships_status_valid check (status in ('pending', 'accepted')),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- ---------------------------------------------------------------------------
-- circle_status: the whole of what one person shares
-- ---------------------------------------------------------------------------
--   weather       today's Inner Weather word, dated by the sharer's day
--   low_since     set while they are "running low"; clears itself after a day
--   rhythm        seven numbers, Monday first: the average pleasantness of
--                 that weekday (-5 … 5, null where there's too little to say)

create table if not exists public.circle_status (
  user_id       uuid primary key references public.users (id) on delete cascade,
  weather       text,
  weather_date  date,
  low_since     timestamptz,
  rhythm        real[],
  updated_at    timestamptz not null default now(),
  constraint circle_status_weather_valid check (
    weather is null or weather in ('clear', 'mild', 'overcast', 'fog', 'storm')
  ),
  constraint circle_status_rhythm_valid check (rhythm is null or cardinality(rhythm) = 7)
);

-- ---------------------------------------------------------------------------
-- circle_nudges: "thinking of you" — no text, by design
-- ---------------------------------------------------------------------------

create table if not exists public.circle_nudges (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references public.users (id) on delete cascade,
  to_user_id    uuid not null references public.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  seen_at       timestamptz
);

create index if not exists circle_nudges_to_unseen_idx on public.circle_nudges (to_user_id, seen_at);
create index if not exists circle_nudges_from_idx on public.circle_nudges (from_user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.friendships enable row level security;
alter table public.circle_status enable row level security;
alter table public.circle_nudges enable row level security;

drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships
  for select to authenticated
  using (
    requester_id = (select private.current_app_user_id())
    or addressee_id = (select private.current_app_user_id())
  );

drop policy if exists circle_status_select_own on public.circle_status;
create policy circle_status_select_own on public.circle_status
  for select to authenticated
  using (user_id = (select private.current_app_user_id()));

drop policy if exists circle_nudges_select_own on public.circle_nudges;
create policy circle_nudges_select_own on public.circle_nudges
  for select to authenticated
  using (
    to_user_id = (select private.current_app_user_id())
    or from_user_id = (select private.current_app_user_id())
  );

grant select on public.friendships, public.circle_status, public.circle_nudges to authenticated;
revoke all on public.friendships, public.circle_status, public.circle_nudges from anon;
