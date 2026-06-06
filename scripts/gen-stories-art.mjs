// Generalized aniconic panel-art generator for ANY Story (matches the Yusuf pipeline).
// $0 via Cloudflare Workers AI FLUX.1-schnell (primary; the same backend the reviewed
// Yusuf art was made with). Scene prompts come from each panel's `scene` field, which is
// object-only (no living beings) — the real safety gate. FLUX ignores negative prompts.
//
//   node --env-file=.env scripts/gen-stories-art.mjs nuh           # all panels
//   node --env-file=.env scripts/gen-stories-art.mjs nuh 5 8       # only panels 5 and 8
//   IMG_BACKEND=pollinations node scripts/gen-stories-art.mjs nuh  # keyless fallback
//   IMG_STEPS=8 ...                                                # bump quality (more neurons)
//
// Output: content/stories/<id>-art/pNN.jpg — REVIEW (Read the montage) before bundling.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!id) {
  console.error('usage: node scripts/gen-stories-art.mjs <story-id> [panel...]');
  process.exit(1);
}
const STORY = JSON.parse(readFileSync(join(HERE, '..', 'mobile', 'assets', 'stories', `${id}.json`), 'utf8'));
const OUT = join(HERE, '..', 'content', 'stories', `${id}-art`);

const ACCT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const STEPS = Number(process.env.IMG_STEPS || 4);
const BACKEND = process.env.IMG_BACKEND || 'cloudflare';

const STYLE =
  'Colored manga-style illustration, bold manga ink linework with screentone shading, ' +
  'cinematic dramatic lighting, atmospheric, reverent and beautiful, highly detailed';
const GUARD =
  'aniconic sacred art: absolutely no people, no human figures, no faces, no characters, no animals, ' +
  'no creatures; an empty scene of only objects, architecture, light, water, and landscape';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function viaPollinations(prompt, n) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${n * 7 + 11}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) throw new Error('tiny/empty image');
    return buf;
  } finally {
    clearTimeout(t);
  }
}

async function viaCloudflare(prompt) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: STEPS }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const b64 = json?.result?.image;
  if (!b64) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 160)}`);
  return Buffer.from(b64, 'base64');
}

async function gen(panel) {
  const prompt = `${STYLE}. Scene: ${panel.scene}. ${GUARD}.`;
  const file = join(OUT, `p${String(panel.n).padStart(2, '0')}.jpg`);
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const buf = BACKEND === 'pollinations' ? await viaPollinations(prompt, panel.n) : await viaCloudflare(prompt);
      writeFileSync(file, buf);
      return Math.round(buf.length / 1024);
    } catch (e) {
      lastErr = e;
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

if (BACKEND === 'cloudflare' && (!ACCT || !TOKEN)) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN (run with --env-file=.env)');
  process.exit(1);
}

const only = process.argv.slice(3).map(Number).filter(Boolean);
const todo = STORY.panels.filter((p) => (only.length ? only.includes(p.n) : true));
mkdirSync(OUT, { recursive: true });
console.log(`[${id}] generating ${todo.length} panel(s) via ${BACKEND} (steps ${STEPS}) -> ${OUT}\n`);

let ok = 0;
for (const p of todo) {
  try {
    const kb = await gen(p);
    ok++;
    console.log(`[${id} p${String(p.n).padStart(2, '0')}] OK  ${kb} KB`);
  } catch (e) {
    console.log(`[${id} p${String(p.n).padStart(2, '0')}] FAIL  ${e.message}`);
  }
  await sleep(1200);
}
console.log(`\n[${id}] done: ${ok}/${todo.length} generated. Review in ${OUT}`);
