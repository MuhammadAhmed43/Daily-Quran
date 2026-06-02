// Update only the `translation` column of every verse in Supabase from the (rebuilt)
// quran.json — used when switching the English translation. PATCH per row so the
// existing embeddings are preserved (the FTS column regenerates automatically).
//
//   node scripts/retranslate-supabase.mjs

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
if (!SUPABASE_URL || !SVC) {
  console.error('Missing Supabase env');
  process.exit(1);
}
const HEADERS = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };

async function patch(id, translation) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/verses?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ translation }),
  });
  if (!res.ok) throw new Error(`patch ${id} ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    }),
  );
}

const quran = JSON.parse(
  readFileSync(new URL('../mobile/assets/quran/quran.json', import.meta.url), 'utf8'),
);
const rows = [];
for (const s of quran.surahs) for (const a of s.ayahs) rows.push({ id: s.number * 1000 + a.n, t: a.en });

console.log(`Updating ${rows.length} translations (${quran.translation})...`);
let done = 0;
await mapLimit(rows, 8, async (r) => {
  await patch(r.id, r.t);
  if (++done % 500 === 0) process.stdout.write(`\r${done}/${rows.length}   `);
});
console.log(`\nUpdated ${done} translations.`);
