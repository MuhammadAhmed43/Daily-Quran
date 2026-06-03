// Dev helper: pretend STRANGERS prayed for an intention, so you can watch "N people prayed for this"
// + the top banner climb on your OWN device (you can't Ameen your own post - that's the whole point).
// Each "stranger" is a fresh anonymous user, so the count really goes up by one. Raw HTTP, no deps.
//   node scripts/ameen-latest.mjs            -> 1 stranger prays for the NEWEST post on the wall
//   node scripts/ameen-latest.mjs 9          -> 9 strangers pray for the newest post ("9 people prayed")
//   node scripts/ameen-latest.mjs <id>       -> 1 stranger prays for a specific intention id
//   node scripts/ameen-latest.mjs <id> 9     -> 9 strangers pray for that id
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

let targetId = null;
let count = 1;
for (const a of process.argv.slice(2)) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(a)) targetId = a;
  else if (/^\d+$/.test(a)) count = Math.max(1, parseInt(a, 10));
}

async function anonSignIn() {
  const res = await fetch(`${SUPA}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  });
  const j = await res.json().catch(() => ({}));
  return { token: j.access_token, uid: j.user?.id };
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

const finder = await anonSignIn();
if (!finder.token) {
  console.log('anon sign-in failed - is "Anonymous sign-ins" enabled in Supabase Auth?');
  process.exit(1);
}

let body = '';
if (!targetId) {
  const sel = await rest('GET', 'intentions?select=id,body&hidden=eq.false&order=created_at.desc&limit=1', finder.token);
  targetId = sel.j?.[0]?.id;
  body = sel.j?.[0]?.body || '';
}
if (!targetId) {
  console.log('No intention found - post one on the wall first, then re-run.');
  process.exit(1);
}
console.log(`Target: ${targetId}${body ? `  ("${body}")` : ''}`);

for (let i = 0; i < count; i++) {
  const s = await anonSignIn(); // a fresh stranger each time -> a distinct ameen
  if (!s.token) {
    console.log('  sign-in failed, skipping one');
    continue;
  }
  const am = await rest('POST', 'ameens', s.token, { intention_id: targetId, user_id: s.uid }, 'return=minimal');
  console.log(`  +1 ameen from a stranger (status ${am.status})`);
}

const cnt = await rest('GET', `intentions?id=eq.${targetId}&select=ameen_count`, finder.token);
console.log(`\nameen_count is now ${cnt.j?.[0]?.ameen_count}. Pull-to-refresh the wall to see it climb.`);
