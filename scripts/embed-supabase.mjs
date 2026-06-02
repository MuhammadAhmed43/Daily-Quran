// Embed the seeded corpus with Cloudflare Workers AI bge-m3 (1024-dim) and write
// the vectors back into Supabase. Resumable: only rows with a NULL embedding are
// processed, so you can safely re-run if interrupted.
//
//   node scripts/embed-supabase.mjs           # verses + tafsir
//   node scripts/embed-supabase.mjs verses
//   node scripts/embed-supabase.mjs tafsir

import { readFileSync } from 'node:fs';

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
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const CF_ACCT = env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN = env.CLOUDFLARE_API_TOKEN;
for (const [k, v] of Object.entries({ SUPABASE_URL, SVC, CF_ACCT, CF_TOKEN })) {
  if (!v) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
}

const SB_HEADERS = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  'Content-Type': 'application/json',
};
const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/@cf/baai/bge-m3`;

// bge-m3 caps at 512 tokens (~2000 chars); guard so the API never rejects a chunk.
const clip = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 1800);

async function embed(texts) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(CF_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) return json.result.data; // array of 1024-dim arrays
      if (attempt >= 3) throw new Error(`Cloudflare embed error: ${JSON.stringify(json.errors)}`);
    } else {
      const body = (await res.text()).slice(0, 250);
      // 400 = bad request (e.g. context too large) won't fix itself — surface it.
      if (res.status === 400 || attempt >= 3) throw new Error(`Cloudflare embed ${res.status}: ${body}`);
    }
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }
}

async function fetchNull(table, textcol, limit) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?embedding=is.null&select=id,${textcol}&order=id&limit=${limit}`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`fetch ${table} ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

async function patchEmbedding(table, id, vec) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ embedding: `[${vec.join(',')}]` }),
  });
  if (!res.ok) throw new Error(`patch ${table} ${id} ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }),
  );
}

async function embedTable(table, textcol) {
  let done = 0;
  for (;;) {
    // Keep batches small: a batch of long tafsir chunks can blow past
    // Cloudflare's 60k-token-per-request cap (20 * ~1800 chars stays safe).
    const rows = await fetchNull(table, textcol, 20);
    if (rows.length === 0) break;
    const vecs = await embed(rows.map((r) => clip(r[textcol])));
    await mapLimit(rows, 8, (r, i) => patchEmbedding(table, r.id, vecs[i]));
    done += rows.length;
    process.stdout.write(`\r${table}: ${done} embedded   `);
  }
  console.log(`\n${table} done (${done} this run).`);
}

const mode = process.argv[2] || 'all';
if (mode === 'verses' || mode === 'all') await embedTable('verses', 'translation');
if (mode === 'tafsir' || mode === 'all') await embedTable('tafsir', 'text');
console.log('Embedding complete.');
