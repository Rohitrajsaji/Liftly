-- Liftly: plan tailoring (PROGRAMS.md 3b). The user's tailored plan (their answers, the chosen exercises and swaps, and
-- the explanation text) is saved on their profile so a new phone gets the same plan. It is plain JSON: no name, email
-- or free text. The app ignores a plan that no longer fits the approved menus, so this column is never trusted blindly.
-- Run once in the Supabase SQL Editor, after 0003_debrief_log.sql (SUPABASE_SETUP.md).

alter table public.profiles
  add column tailoring jsonb
  check (tailoring is null or (jsonb_typeof(tailoring) = 'object' and octet_length(tailoring::text) <= 8000));
