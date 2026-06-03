-- Daily Qur'an - Community ("Ameen wall") schema.
-- Run in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- ALSO REQUIRED: Dashboard -> Authentication -> Sign In / Providers -> enable "Anonymous sign-ins".

create extension if not exists pgcrypto;

-- Intentions = short du'a / prayer requests. Created ONLY by the server moderation endpoint
-- (api/ameen-post) via the service role; clients can read non-hidden ones and delete their own.
create table if not exists public.intentions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  author_name  text not null default 'Anonymous',
  body         text not null,
  category     text,
  ameen_count  integer not null default 0,
  report_count integer not null default 0,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists intentions_recent_idx on public.intentions (created_at desc) where hidden = false;
create index if not exists intentions_user_idx on public.intentions (user_id, created_at desc);

-- Optional attached comforting verse refs ("surah:ayah"), shown beneath the post (vetted set only).
alter table public.intentions add column if not exists verse_refs text[];

-- One Ameen per user per intention.
create table if not exists public.ameens (
  intention_id uuid not null references public.intentions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (intention_id, user_id)
);

-- One report per user per intention (auto-hides at the threshold).
create table if not exists public.intention_reports (
  intention_id uuid not null references public.intentions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (intention_id, user_id)
);

-- Keep ameen_count in sync with the ameens table. SECURITY DEFINER so the count update runs as the
-- owner (bypassing RLS) - otherwise the invoking user's UPDATE is silently blocked (no update policy).
create or replace function public.bump_ameen() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.intentions set ameen_count = ameen_count + 1 where id = new.intention_id;
  elsif (tg_op = 'DELETE') then
    update public.intentions set ameen_count = greatest(0, ameen_count - 1) where id = old.intention_id;
  end if;
  return null;
end; $$;
drop trigger if exists ameens_count on public.ameens;
create trigger ameens_count after insert or delete on public.ameens
  for each row execute function public.bump_ameen();

-- A report increments the count and auto-hides the intention at 3 reports. SECURITY DEFINER (same
-- reason as bump_ameen - the count/hide update must bypass RLS).
create or replace function public.bump_report() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.intentions
    set report_count = report_count + 1,
        hidden = (report_count + 1) >= 3
    where id = new.intention_id;
  return null;
end; $$;
drop trigger if exists reports_count on public.intention_reports;
create trigger reports_count after insert on public.intention_reports
  for each row execute function public.bump_report();

-- Row-Level Security.
alter table public.intentions enable row level security;
alter table public.ameens enable row level security;
alter table public.intention_reports enable row level security;

-- intentions: read visible (or your own); delete your own. There is intentionally NO insert/update
-- policy for clients -> only the service-role moderation endpoint can create them, so the safety
-- gate can never be bypassed by a direct client write.
drop policy if exists "read intentions" on public.intentions;
create policy "read intentions" on public.intentions for select to authenticated
  using (hidden = false or user_id = auth.uid());
drop policy if exists "delete own intention" on public.intentions;
create policy "delete own intention" on public.intentions for delete to authenticated
  using (user_id = auth.uid());

-- ameens: manage your own only (public counts come from intentions.ameen_count). You may NOT Ameen your
-- OWN intention - a self-ameen must never inflate "N people prayed for you" (blocked in the check below).
drop policy if exists "read own ameens" on public.ameens;
create policy "read own ameens" on public.ameens for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert own ameen" on public.ameens;
create policy "insert own ameen" on public.ameens for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from public.intentions i where i.id = intention_id and i.user_id = auth.uid())
  );
drop policy if exists "delete own ameen" on public.ameens;
create policy "delete own ameen" on public.ameens for delete to authenticated using (user_id = auth.uid());

-- reports: insert your own.
drop policy if exists "insert own report" on public.intention_reports;
create policy "insert own report" on public.intention_reports for insert to authenticated with check (user_id = auth.uid());
