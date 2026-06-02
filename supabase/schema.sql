-- Daily Qur'an — AI chat schema (Postgres + pgvector).
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

-- 1) pgvector for embeddings
create extension if not exists vector;

-- 2) Verses: 6,236 ayahs (Tanzil Uthmani Arabic + Pickthall translation).
--    id = surah*1000 + ayah  (e.g. 2255 → 2:255). Scripture is ALWAYS rendered from here.
create table if not exists public.verses (
  id          integer primary key,
  surah       integer not null,
  ayah        integer not null,
  arabic      text    not null,
  translation text    not null,
  embedding   vector(1024),
  fts         tsvector generated always as (to_tsvector('english', translation)) stored
);

-- 3) Tafsir: classical commentary (e.g. Ibn Kathir). Clearly NOT scripture.
create table if not exists public.tafsir (
  id          bigint generated always as identity primary key,
  surah       integer not null,
  ayah        integer not null,
  source      text    not null,
  text        text    not null,
  embedding   vector(1024),
  fts         tsvector generated always as (to_tsvector('english', text)) stored
);

-- 4) Indexes: HNSW for vector cosine similarity, GIN for keyword search.
create index if not exists verses_embedding_idx on public.verses using hnsw (embedding vector_cosine_ops);
create index if not exists verses_fts_idx       on public.verses using gin (fts);
create index if not exists tafsir_embedding_idx on public.tafsir using hnsw (embedding vector_cosine_ops);
create index if not exists tafsir_fts_idx       on public.tafsir using gin (fts);
create index if not exists tafsir_ayah_idx      on public.tafsir (surah, ayah);

-- 5) Hybrid retrieval (vector similarity + keyword) for verses.
create or replace function public.match_verses(
  query_embedding vector(1024),
  query_text      text,
  match_count     int default 8
) returns table (id int, surah int, ayah int, arabic text, translation text, score float)
language sql stable as $$
  with vec as (
    select id, 1 - (embedding <=> query_embedding) as s
    from public.verses
    where embedding is not null
    order by embedding <=> query_embedding
    limit 40
  ),
  kw as (
    select id, ts_rank(fts, websearch_to_tsquery('english', query_text)) as s
    from public.verses
    where query_text <> '' and fts @@ websearch_to_tsquery('english', query_text)
    limit 40
  ),
  merged as (
    select id, max(s) as score
    from (select id, s from vec union all select id, s from kw) u
    group by id
  )
  select v.id, v.surah, v.ayah, v.arabic, v.translation, m.score
  from merged m
  join public.verses v on v.id = m.id
  order by m.score desc
  limit match_count;
$$;

-- 6) Hybrid retrieval for tafsir.
create or replace function public.match_tafsir(
  query_embedding vector(1024),
  query_text      text,
  match_count     int default 4
) returns table (id bigint, surah int, ayah int, source text, text text, score float)
language sql stable as $$
  with vec as (
    select id, 1 - (embedding <=> query_embedding) as s
    from public.tafsir
    where embedding is not null
    order by embedding <=> query_embedding
    limit 40
  ),
  kw as (
    select id, ts_rank(fts, websearch_to_tsquery('english', query_text)) as s
    from public.tafsir
    where query_text <> '' and fts @@ websearch_to_tsquery('english', query_text)
    limit 40
  ),
  merged as (
    select id, max(s) as score
    from (select id, s from vec union all select id, s from kw) u
    group by id
  )
  select t.id, t.surah, t.ayah, t.source, t.text, m.score
  from merged m
  join public.tafsir t on t.id = m.id
  order by m.score desc
  limit match_count;
$$;

-- 7) Row-Level Security: lock both tables. The mobile app NEVER queries these
--    directly — it goes through our Vercel /api/chat, which uses the service_role
--    key (which bypasses RLS). With RLS on and no policies, anon access is denied.
alter table public.verses enable row level security;
alter table public.tafsir enable row level security;
