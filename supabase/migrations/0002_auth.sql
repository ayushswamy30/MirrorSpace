-- MirrorSpace — Supabase Auth integration
--
-- Identity moves from a device-generated `local_id` in localStorage to
-- Supabase Auth. Everyone starts as an anonymous auth user; attaching an
-- email or a Google identity later keeps the same auth.users.id, so a user
-- upgrades without losing a single journal entry.
--
-- Run after 0001_init.sql. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- users: link to auth.users
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists email        text,
  add column if not exists is_anonymous boolean not null default true;

-- `local_id` is legacy: it identified pre-auth anonymous devices. New rows
-- are keyed on auth_user_id. Kept nullable so existing rows survive.
alter table public.users alter column local_id drop not null;

comment on column public.users.local_id is
  'Legacy pre-Supabase-Auth device id. Null for all users created after 0002.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_auth_user_id_fkey'
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users (id) on delete cascade;
  end if;

  -- A row must be reachable by at least one identity, or it is orphaned data.
  if not exists (
    select 1 from pg_constraint where conname = 'users_identity_present'
  ) then
    alter table public.users
      add constraint users_identity_present
      check (auth_user_id is not null or local_id is not null);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: the public.users row for the caller
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the lookup itself is not filtered by the policies below.
-- Policies on public.users deliberately compare auth.uid() directly instead of
-- calling this, which would recurse.

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid()
$$;

revoke all on function public.current_app_user_id() from public;
grant execute on function public.current_app_user_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security policies
-- ---------------------------------------------------------------------------
-- 0001 enabled RLS with no policies, which denied everything. Now that
-- auth.uid() means something, each table gets per-user policies.
--
-- The API still reaches Postgres with the service_role key and bypasses all of
-- this; these policies govern the `authenticated` role, i.e. anything the
-- browser does with the publishable key (direct reads, realtime) now or later.
-- `anon` is granted nothing at all: a session is required, even an anonymous
-- one.

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- No insert or delete policy for `authenticated`: provisioning and erasure go
-- through the API, so a client cannot mint or destroy account rows directly.

do $$
declare
  t text;
begin
  foreach t in array array[
    'sleep_logs', 'journal_entries', 'insights',
    'chat_sessions', 'mood_patterns', 'calm_triggers'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_rw_own', t);
    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (user_id = public.current_app_user_id())
         with check (user_id = public.current_app_user_id())',
      t || '_rw_own', t
    );
  end loop;
end;
$$;

-- chat_messages has no user_id of its own; ownership runs through its session.
drop policy if exists chat_messages_rw_own on public.chat_messages;
create policy chat_messages_rw_own on public.chat_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and s.user_id = public.current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and s.user_id = public.current_app_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Policies do nothing without a grant. `authenticated` gets table access that
-- the policies above then narrow to the caller's own rows; `anon` stays with
-- nothing.

grant usage on schema public to authenticated;

grant select, update on public.users to authenticated;
grant select, insert, update, delete on
  public.sleep_logs,
  public.journal_entries,
  public.insights,
  public.chat_sessions,
  public.chat_messages,
  public.mood_patterns,
  public.calm_triggers
to authenticated;

revoke all on all tables in schema public from anon;
