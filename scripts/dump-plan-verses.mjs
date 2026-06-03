// Print the FULL Talal Itani English for every verse referenced in plans.ts, so framing quotes can
// be aligned to exactly what the app renders. Run from repo root: node scripts/dump-plan-verses.mjs
import { readFileSync } from 'node:fs';
const quran = JSON.parse(readFileSync('mobile/assets/quran/quran.json', 'utf8'));
const byNum = new Map(quran.surahs.map((s) => [s.number, s]));
const text = (surah, ayah) => {
  const a = byNum.get(surah)?.ayahs.find((y) => y.n === ayah);
  return a ? a.en : '(missing)';
};
const lines = readFileSync('mobile/lib/plans.ts', 'utf8').split(/\r?\n/);
let title = null;
for (const line of lines) {
  const tM = line.match(/^\s*title:\s*'(.+)',\s*$/);
  if (tM) title = tM[1];
  if (!/^\s*verses:/.test(line) || line.includes('Ref[]')) continue;
  const re = /ref\(\s*(\d+)((?:\s*,\s*\d+)+)\)/g;
  let m;
  const refs = [];
  while ((m = re.exec(line)) !== null) {
    const surah = Number(m[1]);
    for (const a of m[2].match(/\d+/g).map(Number)) refs.push([surah, a]);
  }
  if (!refs.length) continue;
  console.log(`\n# ${title}`);
  for (const [s, a] of refs) console.log(`  ${s}:${a}  ${text(s, a)}`);
}
