// Tile a story's generated panel art into ONE labelled contact-sheet PNG, so the
// (image-blind) reviewer can eyeball all panels at once for depiction-safety + context fit.
//   node scripts/montage-story.mjs nuh
// Output: content/stories/_montage-<id>.png
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!id) {
  console.error('usage: node scripts/montage-story.mjs <story-id>');
  process.exit(1);
}
const SRC = join(HERE, '..', 'content', 'stories', `${id}-art`);
const files = readdirSync(SRC).filter((f) => /^p\d\d\.jpg$/.test(f)).sort();
if (!files.length) {
  console.error(`no panel art in ${SRC}`);
  process.exit(1);
}

const COLS = 4;
const CELL = 320;
const GAP = 8;
const LABEL = 22;
const rows = Math.ceil(files.length / COLS);
const W = COLS * CELL + (COLS + 1) * GAP;
const H = rows * (CELL + LABEL) + (rows + 1) * GAP;

const cells = [];
for (let i = 0; i < files.length; i++) {
  const r = Math.floor(i / COLS);
  const col = i % COLS;
  const x = GAP + col * (CELL + GAP);
  const y = GAP + r * (CELL + LABEL + GAP);
  const img = await sharp(join(SRC, files[i])).resize(CELL, CELL, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
  cells.push({ input: img, top: y + LABEL, left: x });
  const label = Buffer.from(
    `<svg width="${CELL}" height="${LABEL}"><text x="4" y="16" font-family="sans-serif" font-size="15" fill="#e8dcc0">${id} ${files[i].replace('.jpg', '')}</text></svg>`,
  );
  cells.push({ input: label, top: y, left: x });
}

const out = join(HERE, '..', 'content', 'stories', `_montage-${id}.png`);
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 10, g: 10, b: 10 } } })
  .composite(cells)
  .png()
  .toFile(out);
console.log(`wrote ${out}  ${W}x${H}  (${files.length} panels)`);
