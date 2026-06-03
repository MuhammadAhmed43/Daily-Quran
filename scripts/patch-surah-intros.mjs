// Targeted, human-reviewed fixes to the generated surah intros (run once, deterministic).
// These address accuracy, sensitive framing, and junk theme tags the audit surfaced.
//   node scripts/patch-surah-intros.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const URL_ = new URL('../mobile/assets/quran/surah-intros.json', import.meta.url);
const d = JSON.parse(readFileSync(URL_, 'utf8'));

// 18 Al-Kahf — the model named only the Cave; name all FOUR trials (the surah's defining structure).
d['18'].summary =
  'Built around four stories that each weigh faith against a worldly trial: the young believers of the Cave who flee persecution, the proud owner of two gardens humbled in his wealth, Moses learning patience from the mysterious guide al-Khidr, and the just king Dhul-Qarnayn. Together they test faith against power, wealth, knowledge, and time, and call the reader back to sincerity and trust in God.';
d['18'].themes = ['Faith', 'Trials', 'Humility', 'Patience', 'Knowledge'];

// 10 Yunus — render the prophet's name in standard English.
d['10'].summary = d['10'].summary.replace(/\bJonas\b/g, 'Jonah');

// 109 Al-Kafiroon — "Tolerance" misframes a declaration of non-compromise in worship.
d['109'].themes = d['109'].themes.map((t) => (t === 'Tolerance' ? 'Distinction' : t));

// 111 Al-Masad — tighten wordy multi-word tags to single concepts.
d['111'].themes = ['Opposition', 'Disbelief', 'Punishment'];

// 63 Al-Munafiqoon — "Beware" is an imperative, not a theme.
d['63'].themes = d['63'].themes.map((t) => (t === 'Beware' ? 'Vigilance' : t));

// 80 Abasa — the lesson is attentiveness to the sincere seeker, not "Critique".
d['80'].themes = d['80'].themes.map((t) => (t === 'Critique' ? 'Sincerity' : t));

// 86 At-Tariq — the Tariq is the night-comer (najm thaqib); "morning star" misreads it.
d['86'].summary =
  "A piercing star shines in the night sky, yet people are absorbed in worldly concerns — called to reflect on their own origins and the One who watches over every soul, and warned of the consequences of turning from God's guidance.";

writeFileSync(URL_, JSON.stringify(d, null, 2) + '\n', 'utf8');
console.log('patched: 18 (Kahf 4 trials), 10 (Jonah), 109/111/63/80 (themes)');
