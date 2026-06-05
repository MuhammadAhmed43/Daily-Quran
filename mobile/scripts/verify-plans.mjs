// Verify every verse reference in lib/plans.ts resolves to a real ayah in the bundled Qur'an, and print
// the actual translation per plan/step so the selections + framing can be reviewed for accuracy.
// Run: node scripts/verify-plans.mjs
import { readFileSync } from 'node:fs';

const quran = JSON.parse(readFileSync(new URL('../assets/quran/quran.json', import.meta.url), 'utf8'));
const byNum = new Map(quran.surahs.map((s) => [s.number, s]));
const src = readFileSync(new URL('../lib/plans.ts', import.meta.url), 'utf8');

const refRe = /ref\(\s*(\d+)\s*,\s*([\d,\s]+?)\)/g;
const CAP = 220;

let currentPlan = '(none)';
let currentStep = '(none)';
let expectPlan = false;
let expectStep = false;
let total = 0;
let bad = 0;
const badList = [];
const seen = new Map();
const out = [];

for (const raw of src.split('\n')) {
  const line = raw.trim();
  if (line.startsWith('id:')) {
    expectPlan = true;
    continue;
  }
  if (line.startsWith('order:')) expectStep = true;
  const tm = line.match(/^title:\s*'(.+?)',?$/);
  if (tm) {
    if (expectPlan) {
      currentPlan = tm[1];
      currentStep = '(none)';
      expectPlan = false;
      out.push(`\n=== ${currentPlan} ===`);
    } else if (expectStep) {
      currentStep = tm[1];
      expectStep = false;
    }
  }
  if (line.includes('ref(')) {
    let m;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(line))) {
      const surah = Number(m[1]);
      const ayahs = m[2]
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      for (const a of ayahs) {
        total++;
        const s = byNum.get(surah);
        const ayah = s && s.ayahs.find((x) => x.n === a);
        const key = `${surah}:${a}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(`${currentPlan} / ${currentStep}`);
        if (!s || !ayah) {
          bad++;
          badList.push(`${key} (${currentPlan} / ${currentStep})`);
          out.push(`   BAD  ${key}  -> UNRESOLVED (surah has ${s ? s.numberOfAyahs : '?'} ayahs)`);
          continue;
        }
        const en = ayah.en.length > CAP ? ayah.en.slice(0, CAP) + '…' : ayah.en;
        out.push(`   ${key}  ${s.englishName}  "${en}"`);
      }
    }
  }
}

out.push(`\n--- ${total} verse refs checked, ${bad} BAD ---`);
if (bad) out.push('BAD refs: ' + badList.join('; '));
const dups = [...seen.entries()].filter(([, v]) => v.length > 1);
out.push(`\nVerses reused across steps: ${dups.length}`);
for (const [k, v] of dups) out.push(`  ${k}  x${v.length}  [${v.join(' | ')}]`);
console.log(out.join('\n'));
process.exit(bad > 0 ? 1 : 0);
