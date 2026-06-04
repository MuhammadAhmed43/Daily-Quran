-- Daily Qur'an - cloud sync. One row per user holding a JSON bundle of their synced on-device stores
-- (profile, streak/activity, bookmarks, plans, prayer log, preferences). The CLIENT reads/writes this
-- directly under RLS (own-row only) - unlike the Ameen wall there is nothing to moderate, it is the
-- user's own data. Merge logic lives client-side (lib/sync-merge.ts): union for ledgers/lists,
-- last-write-wins for single documents. Run in the Supabase SQL Editor.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "read own state" on public.user_state;
create policy "read own state" on public.user_state for select to authenticated using (user_id = auth.uid());

drop policy if exists "insert own state" on public.user_state;
create policy "insert own state" on public.user_state for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own state" on public.user_state;
create policy "update own state" on public.user_state for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
