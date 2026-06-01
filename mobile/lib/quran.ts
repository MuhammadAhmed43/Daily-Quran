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
    .replace(/(.)\1+/g, '$1')
    .replace(/^al/, '');
}

const ALIAS_NORM: Record<string, [number, number?]> = {};
for (const [k, v] of Object.entries(ALIASES)) ALIAS_NORM[norm(k)] = v;

const ALIAS_LABELS: Record<string, string> = {
  [norm('ayat al-kursi')]: 'Ayat al-Kursi',
  [norm('ayatul kursi')]: 'Ayat al-Kursi',
  [norm('throne verse')]: 'Ayat al-Kursi',
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

// --- Keyword search over the (Pickthall) translation ---
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
