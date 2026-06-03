// Verify every verse reference in mobile/lib/plans.ts resolves against the bundled Qur'an DB,
// and print the English so the pastoral fit can be eyeballed. Run from repo root:
//   node scripts/verify-plans.mjs
import { readFileSync } from 'node:fs';

const quran = JSON.parse(readFileSync('mobile/assets/quran/quran.json', 'utf8'));
const byNum = new Map(quran.surahs.map((s) => [s.number, s]));

function getAyah(surah, ayah) {
  const s = byNum.get(surah);
  const a = s?.ayahs.find((y) => y.n === ayah);
  return s && a ? { surahEnglish: s.englishName, en: a.en } : null;
}

const lines = readFileSync('mobile/lib/plans.ts', 'utf8').split(/\r?\n/);

let track = '?';
let curTitle = null;
let stepCount = 0;
let refCount = 0;
const failures = [];
const careSteps = [];
const out = [];

for (const line of lines) {
  const idM = line.match(/^\s{2}id:\s*'([^']+)'/); // track-level id (2-space indent)
  if (idM) track = idM[1];
  const tM = line.match(/^\s*title:\s*'(.+)',\s*$/);
  if (tM) curTitle = tM[1];

  if (!/^\s*verses:/.test(line)) continue;
  if (line.includes('Ref[]')) continue; // the type definition, not a step

  stepCount++;
  // care step: `verses: [],`
  if (/^\s*verses:\s*\[\s*\],/.test(line)) {
    careSteps.push(`${track} · ${curTitle}`);
    out.push(`  [${track}] ${curTitle}\n      (care step — no verse, by design)`);
    continue;
  }
  // each ref(surah, a1, a2, ...) is one surah; extract independently (handles spread of two)
  const refs = [];
  const re = /ref\(\s*(\d+)((?:\s*,\s*\d+)+)\)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const surah = Number(m[1]);
    const ayahs = (m[2].match(/\d+/g) ?? []).map(Number);
    for (const ayah of ayahs) refs.push({ surah, ayah });
  }
  const rendered = refs.map((r) => {
    refCount++;
    const a = getAyah(r.surah, r.ayah);
    if (!a) {
      failures.push(`${track} · ${curTitle} → ${r.surah}:${r.ayah}`);
      return `      X ${r.surah}:${r.ayah}  <<< UNRESOLVED`;
    }
    return `      ${a.surahEnglish} ${r.surah}:${r.ayah} — ${a.en.slice(0, 78)}`;
  });
  out.push(`  [${track}] ${curTitle}\n${rendered.join('\n')}`);
}

console.log(out.join('\n'));
console.log('\n------------------------------------------');
console.log(`Steps parsed:   ${stepCount}`);
console.log(`Refs checked:   ${refCount}`);
console.log(`Care steps:     ${careSteps.length}  (${careSteps.join('; ')})`);
console.log(`Unresolved:     ${failures.length}`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log('  X ' + f);
  process.exit(1);
}
console.log('\nOK - every reference resolves.');
