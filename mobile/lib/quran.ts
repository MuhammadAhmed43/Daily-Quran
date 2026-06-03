import quran from '@/assets/quran/quran.json';

export type Ayah = { n: number; ar: string; en: string };
export type Surah = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
};

export const SURAHS = quran.surahs as Surah[];

export function getSurah(n: number): Surah | undefined {
  return SURAHS.find((s) => s.number === n);
}

export function getAyah(surah: number, ayah: number): Ayah | undefined {
  return getSurah(surah)?.ayahs.find((a) => a.n === ayah);
}

// --- Reference resolver: "2:255", "2 255", "2", or a known name ---
const ALIASES: Record<string, [number, number?]> = {
  'ayat al-kursi': [2, 255],
  'ayatul kursi': [2, 255],
  'throne verse': [2, 255],
  kursi: [2, 255],
  fatiha: [1],
  'al-fatiha': [1],
  'the opening': [1],
  yaseen: [36],
  'ya-sin': [36],
  'ya sin': [36],
  kahf: [18],
  'al-kahf': [18],
  mulk: [67],
  'al-mulk': [67],
  rahman: [55],
  'ar-rahman': [55],
  ikhlas: [112],
  'al-ikhlas': [112],
  falaq: [113],
  nas: [114],
  baqarah: [2],
  'al-baqarah': [2],
};

// Normalize for fuzzy matching: drop diacritics, punctuation, doubled letters, leading "al".
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/gh/g, 'g')
    .replace(/kh/g, 'k')
    .replace(/q/g, 'k')
    .replace(/w/g, 'u')
    .replace(/e/g, 'i')
    .replace(/o/g, 'u')
    // strip the Arabic article exactly once — sun-letter assimilation first, then plain al-
    .replace(/^a(sh)\1/, '$1') // ash-sh → sh
    .replace(/^a([bcdfghjklmnpqrstvwxyz])\1/, '$1') // at-t, an-n, ar-r, as-s, az-z, ad-d …
    .replace(/^al/, '')
    .replace(/(.)\1+/g, '$1');
}

const ALIAS_NORM: Record<string, [number, number?]> = {};
for (const [k, v] of Object.entries(ALIASES)) ALIAS_NORM[norm(k)] = v;

const ALIAS_LABELS: Record<string, string> = {
  [norm('ayat al-kursi')]: 'Ayat al-Kursi',
  [norm('ayatul kursi')]: 'Ayat al-Kursi',
  [norm('throne verse')]: 'Ayat al-Kursi',
  [norm('kursi')]: 'Ayat al-Kursi',
};

export type RefTarget = { surah: number; ayah?: number; label?: string };

export function resolveReference(query: string): RefTarget | null {
  const t = query.trim().toLowerCase();
  if (!t) return null;

  const pair = t.match(/^(\d{1,3})\s*[:.\-\s]\s*(\d{1,3})$/);
  if (pair) {
    const surah = +pair[1];
    const ayah = +pair[2];
    if (getAyah(surah, ayah)) return { surah, ayah };
  }
  const single = t.match(/^(\d{1,3})$/);
  if (single) {
    const surah = +single[1];
    if (getSurah(surah)) return { surah };
  }
  const key = norm(query);
  const alias = ALIAS_NORM[key];
  if (alias) return { surah: alias[0], ayah: alias[1], label: ALIAS_LABELS[key] };
  return null;
}

// --- Surah search by name / number ---
export function searchSurahs(query: string): Surah[] {
  const raw = query.trim();
  const t = norm(raw);
  if (t.length < 2) return [];
  return SURAHS.filter((s) => {
    const en = norm(s.englishName);
    const tr = norm(s.englishNameTranslation);
    return en.includes(t) || t.includes(en) || tr.includes(t) || String(s.number) === raw;
  }).slice(0, 8);
}

// --- Fuzzy ranking: tolerate wrong/missing letters anywhere (typos, mishearings) ---
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

// 0..1 similarity between two already-normalized strings.
function matchScore(q: string, name: string): number {
  if (!q || !name) return 0;
  if (q === name) return 1;
  if (name.includes(q) || q.includes(name)) {
    const ratio = Math.min(q.length, name.length) / Math.max(q.length, name.length);
    return 0.85 + 0.15 * ratio; // containment is strong; prefer closer lengths
  }
  return 1 - editDistance(q, name) / Math.max(q.length, name.length);
}

export type RankedSurah = { surah: Surah; score: number };

// Rank every surah by how close its (normalized) name is to the query, so a
// misspelled or mis-heard name still surfaces the right surah, best-first.
export function rankSurahs(query: string, limit = 8): RankedSurah[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return SURAHS.map((s) => {
    const nameScore = matchScore(q, norm(s.englishName));
    const tr = norm(s.englishNameTranslation);
    const meaningScore = tr.includes(q) || q.includes(tr) ? 0.7 : 0; // e.g. "cow" → Al-Baqara
    return { surah: s, score: Math.max(nameScore, meaningScore) };
  })
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// --- Keyword search over the (Itani) translation ---
export type VerseHit = { surah: number; ayah: number; surahEnglish: string; en: string };

export function searchVerses(query: string, limit = 40): VerseHit[] {
  const t = query.trim().toLowerCase();
  if (t.length < 2) return [];
  const hits: VerseHit[] = [];
  for (const s of SURAHS) {
    for (const a of s.ayahs) {
      if (a.en.toLowerCase().includes(t)) {
        hits.push({ surah: s.number, ayah: a.n, surahEnglish: s.englishName, en: a.en });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}
