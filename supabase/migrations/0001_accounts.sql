-- Liftly M5: accounts, profile sync, consent, account deletion.
-- Run once in the Supabase SQL Editor (SUPABASE_SETUP.md). Safe to read before running: it only creates the
-- tables below, their row-level security, one trigger and one function. Nothing here reads or changes auth settings.
--
-- Rules:
--   * Every row belongs to one user and only that user can read or write it (RLS, auth.uid()).
--   * Rows carry a client-made id or the user id, so a retried upload cannot create a duplicate (TESTING O-03).
--   * Conflict behaviour for the profile (the one editable row): the newest updated_at wins; a stale write
--     from a phone that was offline is ignored (DECISIONS S1).

create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  months_training integer not null check (months_training between 0 and 60),
  program        text not null check (program in ('3-day', '4-day')),
  start_date     date not null,
  updated_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

-- Append-only: a consent is recorded once and never edited (SAFETY section 6).
create table public.consents (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  consent_version text not null check (length(consent_version) between 1 and 64),
  accepted_at     timestamptz not null,
  created_at      timestamptz not null default now()
);
create index consents_user_id_idx on public.consents (user_id);

alter table public.profiles enable row level security;
alter table public.consents enable row level security;

-- Signed-out visitors (the anon role) get nothing.
revoke all on public.profiles, public.consents from anon, public;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.consents to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy consents_select_own on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_insert_own on public.consents for insert to authenticated with check (user_id = auth.uid());

-- Newest write wins. An older updated_at leaves the stored row as it is.
create function public.profiles_keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end $$;

create trigger profiles_keep_newest before update on public.profiles
  for each row execute function public.profiles_keep_newest();

-- Account deletion: removes the signed-in user and, through the foreign keys, all of their rows.
-- Runs with the owner's rights so no secret key is needed in the app.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
