-- MirrorSpace — web push, for the app added to a Home Screen
--
-- A browser can't schedule a notification for later, so for the web app the
-- server sends them all: the daily reminder, a letter's day, a reflection
-- that is ready, and Circle alerts. A browser that allows notifications hands the API its push
-- subscription — an address at Apple's, Google's, Mozilla's or Microsoft's
-- push service, and the two keys that encrypt what is sent to it — with the
-- times it wants a nudge. Only times: never what was written or felt, and
-- never a letter.
--
-- Like the reminder on a phone, only the next one waits: once sent, a row is
-- gone until the app opens again and asks for the next. `alerts` is the
-- person's own switch for everything but the reminder (You -> Notifications).
--
-- Run after 0007_circle_icon.sql. Idempotent — safe to re-run.

create table if not exists public.web_push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  alerts      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint web_push_endpoint_valid check (endpoint ~ '^https://[^/]+/' and length(endpoint) <= 1024),
  constraint web_push_p256dh_valid check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  constraint web_push_auth_valid check (auth ~ '^[A-Za-z0-9_-]{16,32}$')
);

create index if not exists web_push_subscriptions_user_idx on public.web_push_subscriptions (user_id);

create table if not exists public.web_push_schedule (
  id        bigint generated always as identity primary key,
  endpoint  text not null references public.web_push_subscriptions (endpoint) on delete cascade,
  kind      text not null,
  send_at   timestamptz not null,
  constraint web_push_schedule_kind_valid check (kind in ('reminder', 'letter', 'reflection'))
);

create index if not exists web_push_schedule_send_at_idx on public.web_push_schedule (send_at);
create index if not exists web_push_schedule_endpoint_idx on public.web_push_schedule (endpoint);

-- Only the API (service role) reads or writes these; no client needs to.
alter table public.web_push_subscriptions enable row level security;
alter table public.web_push_schedule enable row level security;
revoke all on public.web_push_subscriptions from anon, authenticated;
revoke all on public.web_push_schedule from anon, authenticated;
