// One-off: generate a few beautiful crescent-moon options for the voice screen.
//   node scripts/gen-crescent.mjs   (keyless FLUX via Pollinations)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'mobile', 'assets', 'voice');
mkdirSync(OUT, { recursive: true });

const prompt =
  'a single beautiful luminous golden crescent moon glowing softly, with a warm ethereal ' +
  'golden halo of light that radiates outward and fades smoothly into pure deep black, ' +
  'perfectly centered, minimalist elegant sacred and serene, no face, no stars, no clouds, ' +
  'no landscape, pure black background, soft glow, digital art';

const seeds = [11, 42, 77];
for (let i = 0; i < seeds.length; i++) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&model=flux&nologo=true&seed=${seeds[i]}`;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(OUT, `crescent-${i + 1}.jpg`), buf);
  console.log(`crescent-${i + 1}.jpg  ${Math.round(buf.length / 1024)} KB`);
}
console.log('Review in mobile/assets/voice/');
