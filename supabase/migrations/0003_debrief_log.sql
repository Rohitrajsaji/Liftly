-- Liftly M8: a per-user ledger of debrief requests, so the debrief function can cap how many Claude calls one account
-- can cause (cost protection). It holds no workout data: only who asked and when.
-- Run once in the Supabase SQL Editor, after 0002_workouts.sql (SUPABASE_SETUP.md).

create table public.debrief_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index debrief_log_user_created_idx on public.debrief_log (user_id, created_at);

alter table public.debrief_log enable row level security;
revoke all on public.debrief_log from anon, public;
grant select, insert on public.debrief_log to authenticated;

create policy debrief_log_select_own on public.debrief_log for select to authenticated using (user_id = auth.uid());
create policy debrief_log_insert_own on public.debrief_log for insert to authenticated with check (user_id = auth.uid());
