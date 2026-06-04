// Diagnose cloud sync server-side WITHOUT the app: anon sign-in -> upsert user_state -> read it back
// under RLS -> update it -> confirm. Tells us whether supabase/user-state.sql is applied + RLS works.
//   node scripts/spike-sync.mjs
import { readFileSync } from 'node:fs';

function loadEnv(rel) {
  const t = readFileSync(new URL(rel, import.meta.url), 'utf8');
  const e = {};
  for (const l of t.split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].trim();
  }
  return e;
}
const env = loadEnv('../.env');
const SUPA = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;

let fails = 0;
const ok = (c, m) => {
  console.log((c ? '  OK  ' : '  XX  ') + m);
  if (!c) fails++;
};

async function anonSignIn() {
  const res = await fetch(`${SUPA}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, token: j.access_token, uid: j.user?.id, raw: j };
}
async function rest(method, path, token, body, prefer) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let j = null;
  try {
    j = txt ? JSON.parse(txt) : null;
  } catch {
    j = txt;
  }
  return { status: res.status, j };
}

console.log('1) anonymous sign-in');
const a = await anonSignIn();
if (!a.token) {
  console.log('  XX  anon sign-in FAILED (' + a.status + '): ' + JSON.stringify(a.raw).slice(0, 200));
  process.exit(1);
}
ok(!!a.token, 'got a session');

console.log('2) upsert my user_state row (INSERT under RLS)');
const up = await rest(
  'POST',
  'user_state',
  a.token,
  { user_id: a.uid, state: { 'daily-quran:bookmarks': [{ surah: 2, ayah: 255, at: 1 }] } },
  'resolution=merge-duplicates,return=representation',
);
ok(up.status === 201 || up.status === 200, `upsert returned ${up.status} ${typeof up.j === 'string' ? up.j.slice(0, 160) : (up.j?.message || '')}`);

console.log('3) read it back (SELECT under RLS)');
const sel = await rest('GET', `user_state?user_id=eq.${a.uid}&select=state`, a.token);
const got = Array.isArray(sel.j) ? sel.j[0]?.state : null;
ok(sel.status === 200, `select returned ${sel.status}`);
ok(got && Array.isArray(got['daily-quran:bookmarks']) && got['daily-quran:bookmarks'][0]?.ayah === 255, 'bookmark round-tripped through the cloud');

console.log('4) update it (UPDATE under RLS via upsert)');
const up2 = await rest(
  'POST',
  'user_state',
  a.token,
  { user_id: a.uid, state: { 'daily-quran:activity': { '2024-01-01': { t: ['asked'], n: 1 } } } },
  'resolution=merge-duplicates,return=representation',
);
ok(up2.status === 201 || up2.status === 200, `second upsert returned ${up2.status}`);
const sel2 = await rest('GET', `user_state?user_id=eq.${a.uid}&select=state`, a.token);
const got2 = Array.isArray(sel2.j) ? sel2.j[0]?.state : null;
ok(got2 && got2['daily-quran:activity']?.['2024-01-01']?.n === 1, 'update persisted');

console.log(
  fails === 0
    ? '\nSYNC BACKEND OK - the table + RLS work. If the app still fails, it is client-side.'
    : `\n${fails} issue(s) - most likely supabase/user-state.sql was not applied (run it in the SQL Editor).`,
);
process.exit(fails === 0 ? 0 : 1);
