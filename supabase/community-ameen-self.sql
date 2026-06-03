-- Daily Qur'an - Ameen wall fix: your OWN Ameen must never count on your OWN intention.
-- "N people prayed for this" should mean OTHER people only. Run in the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run). Idempotent + safe to re-run.

-- 1) Block ameening your own intention going forward (RLS). You can only Ameen OTHER people's posts,
--    so intentions.ameen_count is always purely "others who prayed" - never inflated by yourself.
drop policy if exists "insert own ameen" on public.ameens;
create policy "insert own ameen" on public.ameens for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from public.intentions i where i.id = intention_id and i.user_id = auth.uid())
  );

-- 2) Remove any self-ameens already stored (e.g. from earlier testing) - they should never have counted.
delete from public.ameens a
  using public.intentions i
  where a.intention_id = i.id and a.user_id = i.user_id;

-- 3) Recompute every intention's ameen_count from the now self-free source of truth.
update public.intentions i
  set ameen_count = (select count(*) from public.ameens a where a.intention_id = i.id);
