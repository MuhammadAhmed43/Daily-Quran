// Verify every verse in lib/intention-verses.ts resolves against the bundled Qur'an, and print the
// English so a human can confirm each one is genuinely COMFORTING (no warnings / hard verses).
//   node scripts/verify-intention-verses.mjs
import { readFileSync } from 'node:fs';

const quran = JSON.parse(readFileSync('mobile/assets/quran/quran.json', 'utf8'));
const byNum = new Map(quran.surahs.map((s) => [s.number, s]));
function getAyah(surah, ayah) {
  const s = byNum.get(surah);
  const a = s?.ayahs.find((y) => y.n === ayah);
  return s && a ? { name: s.englishName, en: a.en } : null;
}

const lines = readFileSync('mobile/lib/intention-verses.ts', 'utf8').split(/\r?\n/);
let themes = 0;
let refCount = 0;
const failures = [];

for (const line of lines) {
  const idM = line.match(/id:\s*'([^']+)',\s*label:\s*'([^']+)'/);
  if (!idM) continue;
  themes++;
  const [id, label] = [idM[1], idM[2]];
  console.log(`\n[${id}] ${label}`);
  const re = /ref\(\s*(\d+)((?:\s*,\s*\d+)+)\)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const surah = Number(m[1]);
    const ayahs = (m[2].match(/\d+/g) ?? []).map(Number);
    for (const ayah of ayahs) {
      refCount++;
      const a = getAyah(surah, ayah);
      if (!a) {
        failures.push(`${id} -> ${surah}:${ayah}`);
        console.log(`   X ${surah}:${ayah}  <<< UNRESOLVED`);
      } else {
        console.log(`   ${a.name} ${surah}:${ayah} - ${a.en}`);
      }
    }
  }
}

console.log(`\n------------------------------------------`);
console.log(`Themes: ${themes}   Verses: ${refCount}   Unresolved: ${failures.length}`);
if (failures.length) {
  for (const f of failures) console.log('  X ' + f);
  process.exit(1);
}
console.log('OK - every verse resolves. Read the English above to confirm each is comforting.');
