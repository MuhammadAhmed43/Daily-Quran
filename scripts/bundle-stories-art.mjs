// Resize + compress the reviewed panel art into the app bundle, for ANY story.
// Build-time tool — install first: npm i sharp
//   node scripts/bundle-stories-art.mjs nuh
// Reads content/stories/<id>-art/ and writes lean JPEGs into mobile/assets/stories/<id>/
// (capped at 1024px wide, mozjpeg q80) — the same recipe as the Yusuf bundle.
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!id) {
  console.error('usage: node scripts/bundle-stories-art.mjs <story-id>');
  process.exit(1);
}
const SRC = join(HERE, '..', 'content', 'stories', `${id}-art`);
const DST = join(HERE, '..', 'mobile', 'assets', 'stories', id);

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
console.log(`\n[${id}] bundled ${files.length} images, ${Math.round(total / 1024)} KB total -> ${DST}`);
