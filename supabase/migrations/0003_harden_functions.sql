-- MirrorSpace — function hardening
--
-- Closes three findings from Supabase's database linter:
--
--   0011 set_updated_at had a mutable search_path
--   0028 current_app_user_id() was callable by `anon`
--   0029 current_app_user_id() was exposed as a PostgREST RPC endpoint
--
-- Run after 0002_auth.sql. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Pin the trigger function's search_path
-- ---------------------------------------------------------------------------
-- Without this, whatever search_path the calling session happens to have is
-- used to resolve names inside the function. Everything it touches lives in
-- pg_catalog, which is always implicitly present, so an empty path is enough.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Move current_app_user_id() out of the exposed API schema
-- ---------------------------------------------------------------------------
-- PostgREST publishes every function in `public` as an RPC endpoint, so a
-- SECURITY DEFINER helper there is reachable at /rest/v1/rpc/... . It only
-- ever returns the caller's own id, but an unauthenticated role should not be
-- able to invoke a definer function at all.
--
-- `private` is not in PostgREST's exposed schemas, so the endpoint disappears
-- while RLS policies can still call the function — policy expressions resolve
-- against the database, not the API surface.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users where auth_user_id = (select auth.uid())
$$;

revoke all on function private.current_app_user_id() from public, anon;
grant execute on function private.current_app_user_id() to authenticated;

-- Repoint every policy that referenced the public copy.
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
         using (user_id = private.current_app_user_id())
         with check (user_id = private.current_app_user_id())',
      t || '_rw_own', t
    );
  end loop;
end;
$$;

drop policy if exists chat_messages_rw_own on public.chat_messages;
create policy chat_messages_rw_own on public.chat_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and s.user_id = private.current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and s.user_id = private.current_app_user_id()
    )
  );

drop function if exists public.current_app_user_id();
