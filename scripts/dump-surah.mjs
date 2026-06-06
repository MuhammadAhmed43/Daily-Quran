// Print every ayah (number + Itani English) of one or more surahs, so a story author can
// pick + verify real verse references straight from the bundled, verified Qur'an.
//   node scripts/dump-surah.mjs 71 11        # surahs 71 and 11
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const quran = JSON.parse(readFileSync(join(HERE, '..', 'mobile', 'assets', 'quran', 'quran.json'), 'utf8'));

const nums = process.argv.slice(2).map(Number).filter(Boolean);
if (!nums.length) {
  console.error('usage: node scripts/dump-surah.mjs <surah-number> [more...]');
  process.exit(1);
}
for (const n of nums) {
  const s = quran.surahs.find((x) => x.number === n);
  if (!s) {
    console.log(`surah ${n} not found`);
    continue;
  }
  console.log(`\n=== ${n} ${s.englishName} (${s.englishNameTranslation}) — ${s.name} — ${s.numberOfAyahs} ayahs ===`);
  for (const a of s.ayahs) console.log(`${n}:${a.n}  ${a.en}`);
}
