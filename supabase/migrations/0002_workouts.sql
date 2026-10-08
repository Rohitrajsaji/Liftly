-- Liftly M6: workout history and gym ladders.
-- Run once in the Supabase SQL Editor, after 0001_accounts.sql (SUPABASE_SETUP.md).
--
--   events  : append-only facts that build the training plan. kind 'session' is one finished workout (its sets,
--             pain reports and the engine's decisions, as one JSON document); kind 'pain_followup' is the answer to
--             the 24-hour pain question. The client makes the id, so a retried upload is a no-op (TESTING O-03).
--             Nothing here is ever edited or deleted by the app.
--   ladders : the loads the user's gym has for each exercise. Editable, so the newest updated_at wins.
-- Every row belongs to one user and only that user can read or write it.

create table public.events (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('session', 'pain_followup')),
  occurred_at timestamptz not null,
  data        jsonb not null check (pg_column_size(data) < 200000),
  created_at  timestamptz not null default now()
);
create index events_user_occurred_idx on public.events (user_id, occurred_at);

create table public.ladders (
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null check (length(exercise_id) between 1 and 64),
  loads_g     integer[] not null check (cardinality(loads_g) between 1 and 400 and 0 <= all (loads_g)),
  updated_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.events enable row level security;
alter table public.ladders enable row level security;

revoke all on public.events, public.ladders from anon, public;
grant select, insert on public.events to authenticated;
grant select, insert, update on public.ladders to authenticated;

create policy events_select_own on public.events for select to authenticated using (user_id = auth.uid());
create policy events_insert_own on public.events for insert to authenticated with check (user_id = auth.uid());

create policy ladders_select_own on public.ladders for select to authenticated using (user_id = auth.uid());
create policy ladders_insert_own on public.ladders for insert to authenticated with check (user_id = auth.uid());
create policy ladders_update_own on public.ladders for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Newest write wins for a ladder. An older updated_at leaves the stored row as it is.
create function public.ladders_keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end $$;

create trigger ladders_keep_newest before update on public.ladders
  for each row execute function public.ladders_keep_newest();
