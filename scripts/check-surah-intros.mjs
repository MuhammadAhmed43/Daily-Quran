// Audit the generated surah intros for safety/quality issues before shipping (sacred content).
// Read-only: flags likely problems so they can be hand-fixed. Run after build-surah-intros.mjs.
//
//   node scripts/check-surah-intros.mjs

import { readFileSync } from 'node:fs';

const quran = JSON.parse(
  readFileSync(new URL('../mobile/assets/quran/quran.json', import.meta.url), 'utf8'),
);
const intros = JSON.parse(
  readFileSync(new URL('../mobile/assets/quran/surah-intros.json', import.meta.url), 'utf8'),
);
const NAME = Object.fromEntries(quran.surahs.map((s) => [s.number, s.englishName]));

// Phrases that suggest a ruling, a recitation-virtue claim, or sectarian framing — all out of bounds.
const BANNED = [
  /whoever recit/i,
  /whoever read/i,
  /reward (for|of) recit/i,
  /virtue[s]? of recit/i,
  /\bhalal\b/i,
  /\bharam\b/i,
  /\bforbidden\b/i,
  /\bobligatory\b/i,
  /you must\b/i,
  /must not\b/i,
  /\bshall not\b/i,
  /\bsunni\b/i,
  /\bshia\b/i,
  /\bshi'a\b/i,
];

let flagged = 0;
const present = new Set();

for (let n = 1; n <= 114; n++) {
  const e = intros[String(n)];
  if (!e) continue;
  present.add(n);
  const flags = [];
  const summary = e.summary || '';
  const themes = e.themes || [];
  const blob = `${summary} ${e.nameReason || ''}`;

  if (!summary) flags.push('NO summary');
  if (summary.length < 120) flags.push(`short summary (${summary.length})`);
  if (summary.length > 520) flags.push(`long summary (${summary.length})`);
  if (/^(surah|this surah|this chapter|the surah)\b/i.test(summary.trim()))
    flags.push('formulaic opening');
  if (!e.nameReason) flags.push('no nameReason');

  if (themes.length < 3) flags.push(`few themes (${themes.length})`);
  if (themes.length > 5) flags.push(`many themes (${themes.length})`);
  for (const t of themes) {
    if (t.split(/\s+/).length > 3) flags.push(`wordy theme "${t}"`);
  }

  for (const re of BANNED) {
    const m = blob.match(re);
    if (m) flags.push(`BANNED "${m[0]}"`);
  }

  if (flags.length) {
    flagged++;
    console.log(`⚠ ${n} ${NAME[n]}: ${flags.join(' · ')}`);
    console.log(`    themes: [${themes.join(', ')}]`);
  }
}

const missing = [];
for (let n = 1; n <= 114; n++) if (!present.has(n)) missing.push(n);

console.log(`\n${present.size}/114 present · ${flagged} flagged for review`);
if (missing.length) console.log(`missing: ${missing.join(', ')}`);
