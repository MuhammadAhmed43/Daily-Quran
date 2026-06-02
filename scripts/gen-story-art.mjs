// Generate aniconic manga-style panel art for the Yusuf storyboard via Cloudflare
// Workers AI (FLUX.1-schnell). $0 on the free tier.
//
//   node --env-file=.env scripts/gen-story-art.mjs            # all 16
//   node --env-file=.env scripts/gen-story-art.mjs 8 14       # only panels 8 and 14
//
// Output: content/stories/yusuf-art/pNN.jpg  — REVIEW EVERY IMAGE before using it.
// FLUX ignores negative prompts (it's guidance-distilled), so these prompts describe
// ONLY objects, architecture, light and landscape — never a person, face, or figure.
// The human review is the real safety gate against an animate form slipping in.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'content', 'stories', 'yusuf-art');

const ACCT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

const STYLE =
  'Colored manga-style illustration, bold manga ink linework with screentone shading, ' +
  'cinematic dramatic lighting, atmospheric, reverent and beautiful, highly detailed';
const GUARD =
  'aniconic sacred art: absolutely no people, no human figures, no faces, no characters; ' +
  'an empty scene of only objects, architecture, light, and landscape';

// Object-only scenes (no person-words). Tones follow the story's indigo -> gold arc.
const PANELS = [
  { n: 1, scene: 'a small humble ancient mud-brick desert house at night with a single warm glowing window, beneath a vast deep-blue starry sky with one bright radiant star shining directly above it, intimate quiet and atmospheric, the humble beginning of a great story, painterly cinematic depth' },
  { n: 2, scene: 'a breathtaking dramatic deep-night cosmos, eleven brilliant glowing stars together with a radiant glowing sun and a crescent moon, swirling galaxy and luminous nebula clouds in deep blue and gold, awe-inspiring and luminous, atmospheric painterly cinematic depth, only sky and cosmos, no ground, no horizon, no land' },
  { n: 3, scene: 'a single small glowing golden lantern resting on dark ground, closed in and surrounded on every side by long menacing dark shadows and cold encroaching blackness, isolated and threatened, tense ominous and foreboding, cold blue and deep-shadow tones, dramatic painterly cinematic' },
  { n: 4, scene: 'view looking straight up from the bottom of a deep dark stone well, a small distant circle of bright sky high above, a frayed rope dangling down, faint warm glow on the wet stone walls, dramatic vertical perspective, claustrophobic' },
  { n: 5, scene: 'a folded cloth tunic with a dark crimson stain lying on rippled desert sand at dusk, soft melancholy fading light, long shadows, empty and somber, a sense of loss' },
  { n: 6, scene: 'an ancient bronze water bucket and a few scattered gold coins on cracked stone ground, and far in the distance the silhouette of a grand ancient Egyptian palace gateway glowing at golden dusk, warm light' },
  { n: 7, scene: 'ornate carved wooden mashrabiya lattice double doors bolted shut, dramatic shafts of light cutting through the lattice, a torn cloth garment fallen on the tiled floor, a small brass balance scale tilting to one side, chiaroscuro' },
  { n: 8, scene: 'extreme close-up still life of the edge of a banquet table, an embroidered patterned tablecloth, a pile of golden citrus fruits and several small curved knives, a single drop of red on a blade, warm candlelight from the side, plain dark empty background, no statues, no sculptures' },
  { n: 9, scene: 'a small barred prison window high on a bare stone wall casting striped shadows across an empty stone floor, a single pale shaft of light, cold, lonely, quiet dignity' },
  { n: 10, scene: 'a dark stone prison interior with one rising point of brilliant white light overpowering a row of empty dim idol niches, a simple clay cup and a loaf of bread resting on the floor, strong symbolic contrast of light and dark' },
  { n: 11, scene: 'a dramatic symbolic scene split in two: on the left, seven tall lush golden ripe wheat sheaves glowing in warm light; on the right, seven withered grey lifeless wheat stalks in cold shadow; rows of large sealed clay granary storage jars behind; the years of plenty and the years of famine, painterly cinematic' },
  { n: 12, scene: 'rows of large sealed clay granary storehouse jars beside a single ornate iron key, warm golden light, an intricate geometric floor pattern gleaming and made whole, a regal sense of abundance' },
  { n: 13, scene: 'an ornate golden royal goblet hidden inside a woven saddlebag among sacks of grain, warm intimate close-up lighting, a quiet secret, finely detailed' },
  { n: 14, scene: 'a radiant burst of golden light pouring through a simple tall open stone archway, dramatic god-rays and glowing dust filling the frame, warm hopeful and luminous, only light and a plain unadorned stone arch, no ornate carvings, no statues, no figures, no people' },
  { n: 15, scene: 'a clean luminous white cloth tunic lifted and floating in soft heavenly white light, radiant, ethereal, a sense of healing and relief, glowing' },
  { n: 16, scene: 'a triumphant radiant golden night sky, eleven glowing stars together with a bright shining sun and a crescent moon arranged in a great circle and inclining inward toward the center in harmony, warm golden light and soft luminous clouds, the joyful fulfillment of a dream, majestic and serene, painterly cinematic, no ground, no architecture, no people' },
];

async function gen(panel) {
  const prompt = `${STYLE}. Scene: ${panel.scene}. ${GUARD}.`;
  const file = join(OUT, `p${String(panel.n).padStart(2, '0')}.jpg`);

  // Keyless, no-quota fallback (FLUX via Pollinations) for when the Cloudflare daily
  // allocation is spent: IMG_BACKEND=pollinations
  if (process.env.IMG_BACKEND === 'pollinations') {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${panel.n * 7 + 11}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) throw new Error('tiny/empty image');
    writeFileSync(file, buf);
    return { file, kb: Math.round(buf.length / 1024) };
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 8 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.result?.image;
  if (!b64) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(file, buf);
  return { file, kb: Math.round(buf.length / 1024) };
}

const only = process.argv.slice(2).map(Number).filter(Boolean);
const todo = only.length ? PANELS.filter((p) => only.includes(p.n)) : PANELS;

if (process.env.IMG_BACKEND !== 'pollinations' && (!ACCT || !TOKEN)) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN (run with --env-file=.env)');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
console.log(`Generating ${todo.length} panel(s) -> ${OUT}\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
for (const p of todo) {
  try {
    const { kb } = await gen(p);
    ok++;
    console.log(`[p${String(p.n).padStart(2, '0')}] OK  ${kb} KB`);
  } catch (e) {
    console.log(`[p${String(p.n).padStart(2, '0')}] FAIL  ${e.message}`);
  }
  await sleep(1500); // pace the free tier
}
console.log(`\nDone: ${ok}/${todo.length} generated. Review them in content/stories/yusuf-art/`);
