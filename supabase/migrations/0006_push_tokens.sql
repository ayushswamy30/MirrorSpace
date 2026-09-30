-- MirrorSpace — push tokens, for Circle alerts
--
-- A phone that allows notifications hands the API its Expo push token, so a
-- friend's "running low" or "thinking of you" can reach it. One person may
-- have several phones; a token belongs to one person at a time (a phone that
-- changes hands re-registers and moves). Erasing the account removes them.
--
-- Run after 0005_circle.sql. Idempotent — safe to re-run.

create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  platform    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint push_tokens_platform_valid check (platform in ('android', 'ios')),
  constraint push_tokens_token_valid check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$')
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select private.current_app_user_id()));

grant select on public.push_tokens to authenticated;
revoke all on public.push_tokens from anon;
