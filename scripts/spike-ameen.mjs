// One-off spike: verify the Ameen-wall backend end-to-end WITHOUT the app or any node deps (raw HTTP:
// GoTrue anon sign-in + the moderation endpoint + PostgREST under RLS + the Ameen trigger + the
// self-ameen block (your OWN ameen must never count) + rate-limit + crisis interception + cleanup).
// Requires: community.sql + community-ameen-self.sql applied + "Anonymous sign-ins" enabled.
//   node scripts/spike-ameen.mjs
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
const mob = loadEnv('../mobile/.env');
const SUPA = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const API = mob.EXPO_PUBLIC_API_BASE;

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
async function postIntention(token, payload) {
  const res = await fetch(`${API}/api/ameen-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

console.log('1) anonymous sign-in');
const a = await anonSignIn();
if (!a.token) {
  console.log('  XX  anon sign-in FAILED (status ' + a.status + '): ' + JSON.stringify(a.raw).slice(0, 220));
  console.log('      -> is "Anonymous sign-ins" enabled in Supabase Auth?');
  process.exit(1);
}
ok(!!a.token && !!a.uid, 'got an anonymous session');
const token = a.token;
const uid = a.uid;

console.log('2) post a GOOD intention (Groq must APPROVE -> service-role insert)');
const good = await postIntention(token, {
  body: 'Please pray for my mother and an easy recovery, ameen.',
  authorName: 'Spike Tester',
  category: 'health',
});
ok(good.status === 200 && !!good.json.intention?.id, `posted (status ${good.status}) ${good.json.error || ''}`);
const newId = good.json.intention?.id;

console.log('3) read it back via RLS (authenticated select)');
const sel = await rest('GET', 'intentions?select=id,body,author_name,ameen_count,hidden&order=created_at.desc&limit=5', token);
ok(sel.status === 200, `select returned ${sel.status}`);
ok(Array.isArray(sel.j) && sel.j.some((r) => r.id === newId), 'the new intention is visible in the feed');

console.log('4) SELF-ameen is BLOCKED by RLS (your own ameen must never count)');
if (newId) {
  const self = await rest('POST', 'ameens', token, { intention_id: newId, user_id: uid }, 'return=minimal');
  ok(self.status >= 400, `self-ameen rejected (status ${self.status})`);
  const c0 = await rest('GET', `intentions?id=eq.${newId}&select=ameen_count`, token);
  ok(c0.j?.[0]?.ameen_count === 0, `ameen_count still 0 after self-ameen (got ${c0.j?.[0]?.ameen_count})`);
}

console.log('5) a DIFFERENT person Ameens it -> counts (others only)');
const b = await anonSignIn();
ok(!!b.token && b.uid !== uid, `second anonymous user signed in (status ${b.status})`);
if (newId && b.token) {
  const am = await rest('POST', 'ameens', b.token, { intention_id: newId, user_id: b.uid }, 'return=minimal');
  ok(am.status === 201 || am.status === 200, `stranger ameen inserted (status ${am.status})`);
  const cnt = await rest('GET', `intentions?id=eq.${newId}&select=ameen_count`, token);
  ok(cnt.j?.[0]?.ameen_count === 1, `ameen_count is 1 - others only (got ${cnt.j?.[0]?.ameen_count})`);
}

console.log('6) reject a link (URL filter -> 422)');
const link = await postIntention(token, { body: 'pray for me, visit my-shop.com for deals' });
ok(link.status === 422, `link blocked (status ${link.status})`);

console.log('7) crisis -> care response, NOT posted');
const crisis = await postIntention(token, { body: 'i want to end my life' });
ok(crisis.json.blocked === 'crisis', 'crisis intercepted with a helpline message');

console.log('8) rate limit (a 2nd real post within the window -> 429)');
const rl = await postIntention(token, { body: 'Pray for peace and ease for everyone, ameen.' });
ok(rl.status === 429, `rate-limited (status ${rl.status})`);

console.log('9) cleanup (delete own intention via RLS)');
if (newId) {
  const d = await rest('DELETE', `intentions?id=eq.${newId}`, token);
  ok(d.status === 204 || d.status === 200, `deleted (status ${d.status})`);
}

console.log(fails === 0 ? '\nAMEEN BACKEND VERIFIED END-TO-END' : `\n${fails} issue(s) above`);
process.exit(fails === 0 ? 0 : 1);
