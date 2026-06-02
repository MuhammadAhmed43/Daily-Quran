// Resize + compress the reviewed panel art into the app bundle.
// Build-time tool (not an app/Vercel dependency) — install first: npm i sharp
//   node scripts/bundle-story-art.mjs
// Reads the reviewed originals from content/stories/yusuf-art/ and writes lean
// JPEGs into mobile/assets/stories/yusuf/ (capped at 1024px wide, mozjpeg q80).
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'content', 'stories', 'yusuf-art');
const DST = join(HERE, '..', 'mobile', 'assets', 'stories', 'yusuf');

mkdirSync(DST, { recursive: true });
const files = readdirSync(SRC)
  .filter((f) => /^p\d\d\.jpg$/.test(f))
  .sort();

let total = 0;
for (const f of files) {
  const info = await sharp(join(SRC, f))
    .resize({ width: 1024, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(join(DST, f));
  total += info.size;
  console.log(`${f}  ${Math.round(info.size / 1024)} KB`);
}
console.log(`\nBundled ${files.length} images, ${Math.round(total / 1024)} KB total -> mobile/assets/stories/yusuf/`);
