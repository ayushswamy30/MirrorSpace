-- MirrorSpace — the picture a person shows their circle
--
-- One of the app's own cut-outs, chosen under You. Stored as its name only;
-- the check keeps it to pictures the app actually has.
--
-- Run after 0006_push_tokens.sql. Idempotent — safe to re-run.

alter table public.users add column if not exists circle_icon text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_circle_icon_valid') then
    alter table public.users add constraint users_circle_icon_valid check (
      circle_icon is null or circle_icon in (
        'bandage', 'bean', 'beetle', 'butterfly', 'can', 'cat', 'city', 'dice', 'doll', 'eye', 'heart',
        'king', 'kittens', 'lily', 'masks', 'moka', 'orchid', 'stamp', 'swallow', 'swan', 'urchin'
      )
    );
  end if;
end $$;
