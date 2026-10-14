-- MirrorSpace — the 11:11 daily note, and a week of reminders at a time
--
-- The web app now hands the server a week ahead at a time: a reminder for
-- each day, and a daily note for 11:11 in the person's own time, so they keep
-- arriving on days the app isn't opened.
--
-- A daily note carries two short lines — a headline and one line under it —
-- written on the person's own phone from their day. They are lock-screen
-- words: never a feeling word they chose, nothing they wrote. The row is
-- deleted the moment it is sent, and replaced each time the app opens.
--
-- Run after 0008_web_push.sql. Idempotent — safe to re-run.

alter table public.web_push_schedule add column if not exists title text;
alter table public.web_push_schedule add column if not exists body text;

alter table public.web_push_schedule drop constraint if exists web_push_schedule_kind_valid;
alter table public.web_push_schedule
  add constraint web_push_schedule_kind_valid check (kind in ('reminder', 'daily', 'letter', 'reflection'));

alter table public.web_push_schedule drop constraint if exists web_push_schedule_text_valid;
alter table public.web_push_schedule
  add constraint web_push_schedule_text_valid check (
    (kind = 'daily' and length(title) between 1 and 80 and length(body) between 1 and 200)
    or (kind <> 'daily' and title is null and body is null)
  );
