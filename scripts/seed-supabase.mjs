// Seed Supabase with verses (from the bundled quran.json) and Ibn Kathir tafsir
// (from spa5k/tafsir_api). Uses the service_role key from .env — run server-side only.
//
//   node scripts/seed-supabase.mjs            # verses + tafsir
//   node scripts/seed-supabase.mjs verses     # just verses
//   node scripts/seed-supabase.mjs tafsir     # just tafsir
//
// Embeddings are added in a separate step (scripts/embed). This only loads text.

import { readFileSync } from 'node:fs';

// --- tiny .env reader (no dependency) ---
function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

function chunkArray(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function insertBatch(table, rows, { upsert = false } = {}) {
  const prefer = ['return=minimal'];
  if (upsert) prefer.push('resolution=merge-duplicates');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: prefer.join(',') },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Insert ${table} failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

async function deleteWhere(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete ${table} failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// --- 1) Verses (Arabic + Pickthall translation) ---
async function seedVerses() {
  const quran = JSON.parse(
    readFileSync(new URL('../mobile/assets/quran/quran.json', import.meta.url), 'utf8'),
  );
  const rows = [];
  for (const s of quran.surahs) {
    for (const a of s.ayahs) {
      rows.push({
        id: s.number * 1000 + a.n,
        surah: s.number,
        ayah: a.n,
        arabic: a.ar,
        translation: a.en,
      });
    }
  }
  console.log(`Seeding ${rows.length} verses...`);
  for (const batch of chunkArray(rows, 500)) {
    await insertBatch('verses', batch, { upsert: true });
    process.stdout.write('.');
  }
  console.log(`\nVerses done (${rows.length}).`);
}

// --- 2) Tafsir (Ibn Kathir, abridged) — dedupe group-commentary, chunk long blocks ---
const TAFSIR_SOURCE = 'Tafsir Ibn Kathir (abridged)';
const TAFSIR_BASE =
  'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/en-tafisr-ibn-kathir';

function chunkText(text, target = 1500, maxChunks = 8) {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];
  const paras = clean.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if (buf && buf.length + 1 + p.length > target) {
      chunks.push(buf);
      buf = p;
      if (chunks.length >= maxChunks) break;
    } else {
      buf = buf ? `${buf}\n${p}` : p;
    }
  }
  if (buf && chunks.length < maxChunks) chunks.push(buf);
  return chunks.slice(0, maxChunks);
}

async function seedTafsir() {
  console.log('Clearing existing Ibn Kathir tafsir...');
  await deleteWhere('tafsir', `source=eq.${encodeURIComponent(TAFSIR_SOURCE)}`);

  let total = 0;
  for (let surah = 1; surah <= 114; surah++) {
    let ayahs;
    try {
      const res = await fetch(`${TAFSIR_BASE}/${surah}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ayahs = (await res.json()).ayahs || [];
    } catch (e) {
      console.warn(`\n! surah ${surah} fetch failed: ${e.message}`);
      continue;
    }

    // Dedupe consecutive identical commentary (Ibn Kathir repeats a block across a passage).
    const rows = [];
    let prev = null;
    for (const a of ayahs.sort((x, y) => x.ayah - y.ayah)) {
      const text = (a.text || '').trim();
      if (!text || text === prev) continue;
      prev = text;
      for (const c of chunkText(text)) {
        rows.push({ surah, ayah: a.ayah, source: TAFSIR_SOURCE, text: c });
      }
    }
    for (const batch of chunkArray(rows, 200)) {
      await insertBatch('tafsir', batch);
    }
    total += rows.length;
    process.stdout.write(`\rTafsir: surah ${surah}/114 — ${total} chunks   `);
  }
  console.log(`\nTafsir done (${total} chunks).`);
}

const mode = process.argv[2] || 'all';
if (mode === 'verses' || mode === 'all') await seedVerses();
if (mode === 'tafsir' || mode === 'all') await seedTafsir();
console.log('Seed complete.');
