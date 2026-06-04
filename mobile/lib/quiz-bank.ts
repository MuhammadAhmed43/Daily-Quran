// Daily-quiz question bank + deterministic engine. TWO sources, NO live LLM:
//  (1) verified-data questions GENERATED from the bundled, verified surah metadata + verses (correct by
//      construction - surah names, ayah counts, Meccan/Medinan, which-surah-is-this-verse), and
//  (2) a small HAND-AUTHORED bank of foundational, uncontested, Sunni-mainstream facts (pillars,
//      prophets, basic seerah, vocabulary). Conservative on purpose - still owes a human/scholar read.
// The daily set is deterministic by date (everyone gets the same 10), balanced across the four topics.
import surahsMeta from '@/assets/quran/surahs.json';

import { getAyah } from './quran';

export type QuizTopic = 'quran' | 'basics' | 'seerah' | 'vocab';
export const QUIZ_TOPICS: QuizTopic[] = ['quran', 'basics', 'seerah', 'vocab'];
export const DAILY_COUNT = 10;

export type Question = {
  id: string;
  topic: QuizTopic;
  q: string;
  options: string[]; // 4 choices
  answer: number; // index of the correct option (before per-play shuffle)
  explain: string;
  ref?: { surah: number; ayah?: number }; // optional "read in context"
};

type SurahMeta = { number: number; englishName: string; englishNameTranslation: string; revelationType: string; numberOfAyahs: number };
const META = surahsMeta as SurahMeta[];
const meta = (n: number) => META[n - 1];

// ---------- deterministic PRNG (so a given date yields the same quiz everywhere) ----------
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// pick n distinct distractors from `pool` that differ from `correct`
function distractors(pool: string[], correct: string, n: number, seed: number): string[] {
  const uniq = Array.from(new Set(pool)).filter((x) => x !== correct);
  return shuffleWith(uniq, mulberry32(seed)).slice(0, n);
}

// ---------- (1) generated, verified-data questions ----------
const generated: Question[] = [];

// surah-name meanings (well-known, clean translations)
const MEANING_IDS = [1, 2, 6, 7, 12, 16, 17, 18, 19, 24, 25, 27, 29, 53, 55, 57, 67, 71, 72, 76, 78, 96, 105, 106, 108, 109, 112, 113, 114];
const MEANING_POOL = MEANING_IDS.map((id) => meta(id).englishNameTranslation);
for (const id of MEANING_IDS) {
  const m = meta(id);
  generated.push({
    id: `g-mean-${id}`,
    topic: 'quran',
    q: `What does the name of Surah ${m.englishName} mean?`,
    options: [m.englishNameTranslation, ...distractors(MEANING_POOL, m.englishNameTranslation, 3, hashStr('mean' + id))],
    answer: 0,
    explain: `Surah ${m.englishName} means "${m.englishNameTranslation}".`,
    ref: { surah: id },
  });
}

// ayah counts (memorable surahs)
const COUNT_IDS = [1, 2, 18, 36, 55, 67, 78, 112, 108, 114, 113];
for (const id of COUNT_IDS) {
  const m = meta(id);
  const c = m.numberOfAyahs;
  const opts = new Set<number>([c]);
  let d = 1;
  const r = mulberry32(hashStr('count' + id));
  while (opts.size < 4) {
    const delta = (Math.floor(r() * 6) + 1) * (r() < 0.5 ? -1 : 1);
    const cand = c + delta;
    if (cand > 0) opts.add(cand);
    d++;
    if (d > 50) break;
  }
  const options = shuffleWith([...opts], mulberry32(hashStr('count-opt' + id))).map(String);
  generated.push({
    id: `g-count-${id}`,
    topic: 'quran',
    q: `How many ayahs (verses) are in Surah ${m.englishName}?`,
    options,
    answer: options.indexOf(String(c)),
    explain: `Surah ${m.englishName} has ${c} ayahs.`,
    ref: { surah: id },
  });
}

// Meccan / Medinan (one correct of the asked type, three of the other)
const REVELATION_QS: { id: number; type: 'Meccan' | 'Medinan' }[] = [
  { id: 2, type: 'Medinan' }, { id: 4, type: 'Medinan' }, { id: 5, type: 'Medinan' }, { id: 24, type: 'Medinan' },
  { id: 48, type: 'Medinan' }, { id: 62, type: 'Medinan' },
  { id: 18, type: 'Meccan' }, { id: 19, type: 'Meccan' }, { id: 36, type: 'Meccan' }, { id: 67, type: 'Meccan' },
  { id: 112, type: 'Meccan' }, { id: 96, type: 'Meccan' },
];
for (const { id, type } of REVELATION_QS) {
  const m = meta(id);
  const other = type === 'Medinan' ? 'Meccan' : 'Medinan';
  const otherNames = META.filter((s) => s.revelationType === other && s.number !== id).map((s) => s.englishName);
  const options = shuffleWith([m.englishName, ...distractors(otherNames, m.englishName, 3, hashStr('rev' + id))], mulberry32(hashStr('rev-opt' + id)));
  generated.push({
    id: `g-rev-${id}`,
    topic: 'quran',
    q: `Which of these surahs was revealed in ${type === 'Medinan' ? 'Medina' : 'Mecca'}?`,
    options,
    answer: options.indexOf(m.englishName),
    explain: `Surah ${m.englishName} is ${type} (revealed in ${type === 'Medinan' ? 'Medina' : 'Mecca'}).`,
    ref: { surah: id },
  });
}

// which-surah-is-this-verse (well-known verses; text rendered from the verified bundle)
const VERSE_QS: { surah: number; ayah: number }[] = [
  { surah: 1, ayah: 1 }, { surah: 2, ayah: 255 }, { surah: 112, ayah: 1 }, { surah: 94, ayah: 6 },
  { surah: 1, ayah: 5 }, { surah: 67, ayah: 1 }, { surah: 103, ayah: 2 },
];
for (const { surah, ayah } of VERSE_QS) {
  const a = getAyah(surah, ayah);
  const m = meta(surah);
  if (!a) continue;
  const otherNames = META.filter((s) => s.number !== surah).map((s) => s.englishName);
  const options = shuffleWith([m.englishName, ...distractors(otherNames, m.englishName, 3, hashStr(`verse${surah}.${ayah}`))], mulberry32(hashStr(`verse-opt${surah}.${ayah}`)));
  generated.push({
    id: `g-verse-${surah}-${ayah}`,
    topic: 'quran',
    q: `Which surah is this verse from?\n\n"${a.en}"`,
    options,
    answer: options.indexOf(m.englishName),
    explain: `This is Qur'an ${surah}:${ayah}, from Surah ${m.englishName}.`,
    ref: { surah, ayah },
  });
}

// ---------- (2) hand-authored bank (foundational, uncontested) ----------
const authored: Question[] = [
  // --- Qur'an structure ---
  { id: 'q1', topic: 'quran', q: 'How many surahs (chapters) are in the Qur’an?', options: ['114', '99', '110', '120'], answer: 0, explain: 'The Qur’an has 114 surahs.' },
  { id: 'q2', topic: 'quran', q: 'What is the first surah of the Qur’an?', options: ['Al-Fatiha', 'Al-Baqara', 'Al-Ikhlas', 'An-Nas'], answer: 0, explain: 'Al-Fatiha, "The Opening", is the first surah.', ref: { surah: 1 } },
  { id: 'q3', topic: 'quran', q: 'What is the longest surah in the Qur’an?', options: ['Al-Baqara', 'Aal-i-Imraan', 'An-Nisaa', 'Al-A’raaf'], answer: 0, explain: 'Al-Baqara is the longest surah, with 286 ayahs.', ref: { surah: 2 } },
  { id: 'q4', topic: 'quran', q: 'Which surah does NOT begin with "Bismillah"?', options: ['At-Tawba', 'Al-Fatiha', 'An-Nas', 'Al-Mulk'], answer: 0, explain: 'At-Tawba (surah 9) is the only surah that does not open with the Bismillah.', ref: { surah: 9 } },
  { id: 'q5', topic: 'quran', q: 'Which surah is recited in every unit (rak’ah) of the prayer?', options: ['Al-Fatiha', 'Al-Ikhlas', 'Ya-Sin', 'Al-Kawthar'], answer: 0, explain: 'Al-Fatiha is recited in every rak’ah of the salah.', ref: { surah: 1 } },
  { id: 'q6', topic: 'quran', q: 'In which surah is Ayat al-Kursi (the Throne Verse)?', options: ['Al-Baqara', 'Aal-i-Imraan', 'Ya-Sin', 'Al-Kahf'], answer: 0, explain: 'Ayat al-Kursi is verse 2:255, in Surah Al-Baqara.', ref: { surah: 2, ayah: 255 } },
  { id: 'q7', topic: 'quran', q: 'In what language was the Qur’an revealed?', options: ['Arabic', 'Aramaic', 'Hebrew', 'Syriac'], answer: 0, explain: 'The Qur’an was revealed in Arabic.' },
  { id: 'q8', topic: 'quran', q: 'The very first revelation began with words from which surah?', options: ['Al-Alaq', 'Al-Fatiha', 'Al-Muddaththir', 'Al-Qadr'], answer: 0, explain: 'The first revealed verses were the opening of Surah Al-Alaq (96).', ref: { surah: 96, ayah: 1 } },

  // --- Islamic basics ---
  { id: 'b1', topic: 'basics', q: 'How many pillars of Islam are there?', options: ['5', '3', '4', '6'], answer: 0, explain: 'Five: the testimony of faith, prayer, zakat, fasting Ramadan, and Hajj.' },
  { id: 'b2', topic: 'basics', q: 'What is the first pillar of Islam?', options: ['The testimony of faith (Shahada)', 'Prayer', 'Fasting', 'Pilgrimage'], answer: 0, explain: 'The Shahada — bearing witness that there is no god but God and Muhammad is His Messenger.' },
  { id: 'b3', topic: 'basics', q: 'How many obligatory prayers does a Muslim perform each day?', options: ['5', '4', '6', '7'], answer: 0, explain: 'Five daily prayers: Fajr, Dhuhr, Asr, Maghrib, and Isha.' },
  { id: 'b4', topic: 'basics', q: 'In which month do Muslims fast from dawn to sunset?', options: ['Ramadan', 'Shawwal', 'Muharram', 'Rajab'], answer: 0, explain: 'Fasting the month of Ramadan is the fourth pillar.' },
  { id: 'b5', topic: 'basics', q: 'What is the pilgrimage to Mecca called?', options: ['Hajj', 'Umrah', 'Hijrah', 'Zakat'], answer: 0, explain: 'The Hajj is the major pilgrimage; Umrah is the lesser one.' },
  { id: 'b6', topic: 'basics', q: 'What is the obligatory annual charity called?', options: ['Zakat', 'Sadaqah', 'Khums', 'Fitrah'], answer: 0, explain: 'Zakat is obligatory; sadaqah is voluntary charity.' },
  { id: 'b7', topic: 'basics', q: 'How many articles of faith are there in Sunni Islam?', options: ['6', '4', '5', '7'], answer: 0, explain: 'Belief in God, His angels, His books, His messengers, the Last Day, and divine decree.' },
  { id: 'b8', topic: 'basics', q: 'Which angel brought God’s revelation to the Prophet Muhammad ﷺ?', options: ['Jibril (Gabriel)', 'Mikail', 'Israfil', 'Malik'], answer: 0, explain: 'The Angel Jibril conveyed the revelation.' },
  { id: 'b9', topic: 'basics', q: 'In which direction do Muslims face during prayer?', options: ['Toward the Kaaba in Mecca', 'Toward Jerusalem', 'Toward Medina', 'Toward the east'], answer: 0, explain: 'Muslims face the Kaaba in Mecca — the qibla.' },
  { id: 'b10', topic: 'basics', q: 'Which prophet was commanded to build an ark?', options: ['Nuh (Noah)', 'Musa (Moses)', 'Yunus (Jonah)', 'Hud'], answer: 0, explain: 'Prophet Nuh built the ark before the flood.' },
  { id: 'b11', topic: 'basics', q: 'Which prophet was swallowed by a great fish?', options: ['Yunus (Jonah)', 'Yusuf (Joseph)', 'Idris', 'Salih'], answer: 0, explain: 'Prophet Yunus — his story is in Surah Yunus and As-Saaffaat.' },
  { id: 'b12', topic: 'basics', q: 'Who was the first human and the first prophet?', options: ['Adam', 'Nuh (Noah)', 'Ibrahim (Abraham)', 'Idris'], answer: 0, explain: 'Adam was the first human being and the first prophet.' },
  { id: 'b13', topic: 'basics', q: 'Which prophet, with his son Ismail, raised the foundations of the Kaaba?', options: ['Ibrahim (Abraham)', 'Musa (Moses)', 'Adam', 'Dawud (David)'], answer: 0, explain: 'Ibrahim and his son Ismail built the Kaaba (Qur’an 2:127).', ref: { surah: 2, ayah: 127 } },
  { id: 'b14', topic: 'basics', q: 'To which prophet was the Torah (Tawrat) given?', options: ['Musa (Moses)', 'Isa (Jesus)', 'Dawud (David)', 'Harun (Aaron)'], answer: 0, explain: 'The Torah was given to Musa; the Gospel to Isa; the Psalms to Dawud.' },
  { id: 'b15', topic: 'basics', q: 'Which prophet is remembered for his patience through severe illness and loss?', options: ['Ayyub (Job)', 'Yaqub (Jacob)', 'Sulayman (Solomon)', 'Yusuf (Joseph)'], answer: 0, explain: 'Prophet Ayyub is the model of sabr (patience).' },

  // --- Seerah & history ---
  { id: 's1', topic: 'seerah', q: 'In which city was the Prophet Muhammad ﷺ born?', options: ['Mecca', 'Medina', 'Taif', 'Jerusalem'], answer: 0, explain: 'He was born in Mecca.' },
  { id: 's2', topic: 'seerah', q: 'To which city did the Prophet ﷺ migrate in the Hijrah?', options: ['Medina', 'Mecca', 'Damascus', 'Kufa'], answer: 0, explain: 'The Hijrah was the migration to Medina.' },
  { id: 's3', topic: 'seerah', q: 'Who was the Prophet’s ﷺ first wife?', options: ['Khadijah', 'Aisha', 'Hafsa', 'Zaynab'], answer: 0, explain: 'Khadijah bint Khuwaylid was his first wife.' },
  { id: 's4', topic: 'seerah', q: 'In which cave did the Prophet ﷺ receive the first revelation?', options: ['Cave of Hira', 'Cave of Thawr', 'Cave of Uhud', 'Cave of Badr'], answer: 0, explain: 'The first revelation came in the Cave of Hira; Thawr was the cave during the Hijrah.' },
  { id: 's5', topic: 'seerah', q: 'Who was the first caliph after the Prophet ﷺ?', options: ['Abu Bakr', 'Umar', 'Uthman', 'Ali'], answer: 0, explain: 'Abu Bakr as-Siddiq was the first of the rightly-guided caliphs.' },
  { id: 's6', topic: 'seerah', q: 'By what title was the Prophet ﷺ known for his honesty before prophethood?', options: ['Al-Amin (the Trustworthy)', 'Al-Faruq', 'As-Siddiq', 'Al-Hadi'], answer: 0, explain: 'He was called Al-Amin — the trustworthy.' },
  { id: 's7', topic: 'seerah', q: 'Who accompanied the Prophet ﷺ during the Hijrah?', options: ['Abu Bakr', 'Ali', 'Umar', 'Bilal'], answer: 0, explain: 'Abu Bakr was his companion on the migration to Medina.' },
  { id: 's8', topic: 'seerah', q: 'In which city is the Kaaba located?', options: ['Mecca', 'Medina', 'Jerusalem', 'Cairo'], answer: 0, explain: 'The Kaaba stands in the Sacred Mosque in Mecca.' },
  { id: 's9', topic: 'seerah', q: 'Who was the first to call the adhan (the call to prayer)?', options: ['Bilal ibn Rabah', 'Abu Bakr', 'Salman al-Farisi', 'Zayd ibn Harithah'], answer: 0, explain: 'Bilal ibn Rabah was the first muezzin.' },
  { id: 's10', topic: 'seerah', q: 'In Islam, who is the final prophet?', options: ['Muhammad ﷺ', 'Isa (Jesus)', 'Musa (Moses)', 'Ibrahim (Abraham)'], answer: 0, explain: 'Muhammad ﷺ is the seal of the prophets.' },
  { id: 's11', topic: 'seerah', q: 'What is the name of the Prophet’s ﷺ night journey and ascension?', options: ['Isra and Mi’raj', 'The Hijrah', 'The Farewell Hajj', 'Laylat al-Qadr'], answer: 0, explain: 'The Isra (night journey) and Mi’raj (ascension).' },
  { id: 's12', topic: 'seerah', q: 'What does "Hijrah" refer to?', options: ['The migration from Mecca to Medina', 'The farewell pilgrimage', 'The night journey', 'The conquest of Mecca'], answer: 0, explain: 'The Hijrah — the migration that begins the Islamic calendar.' },

  // --- Arabic & vocabulary ---
  { id: 'v1', topic: 'vocab', q: 'What does the word "Islam" mean?', options: ['Submission to God', 'Worship', 'Guidance', 'A covenant'], answer: 0, explain: 'Islam means submission (to God); it shares a root with salam, peace.' },
  { id: 'v2', topic: 'vocab', q: 'What does "Allah" mean?', options: ['God (the One God)', 'An angel', 'A prophet', 'A holy book'], answer: 0, explain: 'Allah is the Arabic word for the One God.' },
  { id: 'v3', topic: 'vocab', q: 'What does "Surah" mean?', options: ['A chapter of the Qur’an', 'A verse', 'A prayer', 'A pilgrimage'], answer: 0, explain: 'A surah is a chapter; the Qur’an has 114.' },
  { id: 'v4', topic: 'vocab', q: 'What does "Ayah" mean?', options: ['A verse (or sign)', 'A chapter', 'A page', 'A reciter'], answer: 0, explain: 'Ayah means a verse — literally a "sign".' },
  { id: 'v5', topic: 'vocab', q: 'What does "Bismillah" mean?', options: ['In the name of God', 'Praise be to God', 'God is the greatest', 'There is no god but God'], answer: 0, explain: 'Bismillah — "In the name of God".' },
  { id: 'v6', topic: 'vocab', q: 'What does "Alhamdulillah" mean?', options: ['Praise be to God', 'In the name of God', 'God willing', 'Glory be to God'], answer: 0, explain: 'Alhamdulillah — "All praise is for God".' },
  { id: 'v7', topic: 'vocab', q: 'What does "Allahu Akbar" mean?', options: ['God is the greatest', 'Praise be to God', 'There is no god but God', 'In the name of God'], answer: 0, explain: 'Allahu Akbar — "God is the greatest".' },
  { id: 'v8', topic: 'vocab', q: 'What does "Iman" mean?', options: ['Faith / belief', 'Charity', 'Fasting', 'Pilgrimage'], answer: 0, explain: 'Iman is faith — the inner belief.' },
  { id: 'v9', topic: 'vocab', q: 'What does "Tawhid" mean?', options: ['The oneness of God', 'The five pillars', 'The Day of Judgment', 'The call to prayer'], answer: 0, explain: 'Tawhid — affirming the absolute oneness of God.' },
  { id: 'v10', topic: 'vocab', q: 'What does "Dua" mean?', options: ['Supplication / personal prayer', 'Fasting', 'Charity', 'Ablution'], answer: 0, explain: 'Dua is calling on God — supplication.' },
  { id: 'v11', topic: 'vocab', q: 'What does "Salah" refer to?', options: ['The ritual prayer', 'The fast', 'The pilgrimage', 'The charity'], answer: 0, explain: 'Salah is the formal prayer, performed five times daily.' },
  { id: 'v12', topic: 'vocab', q: 'What is the "Adhan"?', options: ['The call to prayer', 'A unit of prayer', 'The direction of prayer', 'A kind of fast'], answer: 0, explain: 'The adhan is the call announcing each prayer.' },
  { id: 'v13', topic: 'vocab', q: 'What does "Jannah" mean?', options: ['Paradise', 'Hellfire', 'The grave', 'The judgment'], answer: 0, explain: 'Jannah is Paradise — the garden.' },
  { id: 'v14', topic: 'vocab', q: 'What does "Insha’Allah" mean?', options: ['If God wills', 'Thank God', 'By God', 'God is great'], answer: 0, explain: 'Insha’Allah — "if God wills".' },
  { id: 'v15', topic: 'vocab', q: 'What does "Masjid" mean?', options: ['A mosque (place of prostration)', 'A school', 'A market', 'A fortress'], answer: 0, explain: 'Masjid — a mosque, literally a place of prostration (sujud).' },
  { id: 'v16', topic: 'vocab', q: 'What does "Sawm" mean?', options: ['Fasting', 'Charity', 'Pilgrimage', 'Prayer'], answer: 0, explain: 'Sawm is fasting — the fourth pillar.' },
];

export const POOL: Question[] = [...generated, ...authored];
export const POOL_SIZE = POOL.length;

// Today's deterministic quiz: same 10 for everyone, balanced across the four topics, with options
// shuffled per question (so the answer is not always in the same spot) - all seeded by the date.
export function getDailyQuestions(dayKey: string, n = DAILY_COUNT): Question[] {
  const groups = QUIZ_TOPICS.map((t) => shuffleWith(POOL.filter((q) => q.topic === t), mulberry32(hashStr(`${dayKey}:${t}`))));
  const out: Question[] = [];
  let i = 0;
  while (out.length < n) {
    let added = false;
    for (const g of groups) {
      if (g[i]) {
        out.push(g[i]);
        added = true;
        if (out.length >= n) break;
      }
    }
    if (!added) break;
    i++;
  }
  return out.map((q) => ({ ...shuffleOptions(q, mulberry32(hashStr(`${dayKey}:${q.id}`))) }));
}

// Practice mode: a fresh random set every time (no streak credit).
export function getPracticeQuestions(n = DAILY_COUNT): Question[] {
  return shuffleWith(POOL, Math.random).slice(0, n).map((q) => shuffleOptions(q, Math.random));
}

function shuffleOptions(q: Question, rng: () => number): Question {
  const order = shuffleWith(
    q.options.map((_, i) => i),
    rng,
  );
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}
