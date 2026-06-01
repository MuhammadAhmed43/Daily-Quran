import { toHijri } from 'hijri-converter';

import quran from '@/assets/quran/quran.json';

type Ayah = { n: number; ar: string; en: string };
type SurahData = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
};
const SURAHS = quran.surahs as SurahData[];

export const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Thani', 'Jumada al-Ula',
  'Jumada al-Akhirah', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal',
  'Dhu al-Qaʿdah', 'Dhu al-Hijjah',
];

export type Ref = { surah: number; ayah: number };
export type Verse = Ref & { surahName: string; surahEnglish: string; ar: string; en: string };

export function getVerse(surah: number, ayah: number): Verse | null {
  const s = SURAHS.find((x) => x.number === surah);
  const a = s?.ayahs.find((y) => y.n === ayah);
  if (!s || !a) return null;
  return { surah, ayah, surahName: s.name, surahEnglish: s.englishName, ar: a.ar, en: a.en };
}

const ref = (surah: number, ...ayahs: number[]): Ref[] => ayahs.map((ayah) => ({ surah, ayah }));

export type DayKind = 'sacred' | 'history' | 'weekly' | 'reflection';
export type TodayInfo = {
  hijri: { y: number; m: number; d: number; monthName: string; label: string };
  gregorian: Date;
  kind: DayKind;
  badge: string;
  title: string;
  significance: string;
  caveat?: string;
  refs: Ref[];
};

const LUNAR = 'Dates follow the Umm al-Qura calendar; your local moon-sighting may differ by a day.';

// --- Sacred & recurring days (checked most-specific first) ---
type Sacred = {
  test: (m: number, d: number) => boolean;
  badge: string;
  title: string;
  significance: string;
  refs: Ref[];
};
const SACRED: Sacred[] = [
  { test: (m, d) => m === 12 && d === 9, badge: 'Sacred day', title: 'The Day of Arafah',
    significance: `The pinnacle of Hajj. On this day the verse "This day I have perfected your religion for you" was revealed. Fasting it is highly virtuous for those not on Hajj.`,
    refs: ref(5, 3) },
  { test: (m, d) => m === 12 && d === 10, badge: 'Sacred day', title: 'Eid al-Adha',
    significance: `The Festival of Sacrifice — recalling Prophet Ibrahim's willingness to sacrifice his son, and Allah's ransom of him. It coincides with the completion of Hajj.`,
    refs: [...ref(37, 107), ...ref(108, 2)] },
  { test: (m, d) => m === 12 && d >= 11 && d <= 13, badge: 'Sacred days', title: 'The Days of Tashriq',
    significance: `The days after Eid al-Adha, set aside for the remembrance of Allah.`,
    refs: ref(2, 203) },
  { test: (m, d) => m === 12 && d >= 1 && d <= 8, badge: 'Sacred days', title: 'The First Ten Days of Dhu al-Hijjah',
    significance: `The most beloved days for righteous deeds. Allah swears by these ten nights in the Qur'an.`,
    refs: ref(89, 1, 2) },
  { test: (m, d) => m === 9 && d === 27, badge: 'Sacred night', title: 'Laylat al-Qadr (27th night)',
    significance: `The Night of Decree — "better than a thousand months" — most emphasized on the 27th night, when the revelation of the Qur'an began.`,
    refs: ref(97, 1, 2, 3) },
  { test: (m, d) => m === 9 && d >= 21 && d <= 30, badge: 'Sacred nights', title: 'The Last Ten Nights of Ramadan',
    significance: `Seek Laylat al-Qadr in the odd nights of these last ten — the Prophet ﷺ devoted himself to worship in them.`,
    refs: ref(97, 1, 2, 3) },
  { test: (m) => m === 9, badge: 'Sacred month', title: 'Ramadan',
    significance: `The month of fasting, in which the Qur'an was sent down as guidance for humankind.`,
    refs: ref(2, 185) },
  { test: (m, d) => m === 10 && d === 1, badge: 'Sacred day', title: 'Eid al-Fitr',
    significance: `The festival marking the end of Ramadan — a day of gratitude for completing the fast.`,
    refs: ref(2, 185) },
  { test: (m, d) => m === 1 && d === 10, badge: 'Sacred day', title: 'The Day of Ashura',
    significance: `A day of deep significance across the ummah: many Sunni Muslims fast it, recalling Allah's deliverance of Musa and his people; for Shia Muslims it commemorates the martyrdom of Imam Husayn at Karbala.`,
    refs: ref(10, 90) },
  { test: (m, d) => m === 1 && d === 1, badge: 'Sacred day', title: 'Islamic New Year (Hijri)',
    significance: `The Hijri year begins, marking the Prophet's migration (Hijrah) from Makkah to Madinah — a turning point for the early Muslim community.`,
    refs: ref(9, 40) },
  { test: (m, d) => m === 3 && d === 12, badge: 'Commemoration', title: 'Rabiʿ al-Awwal — the Prophet ﷺ',
    significance: `This date is widely associated with the birth of the Prophet Muhammad ﷺ. Muslims differ on how (or whether) to commemorate it; all honour him as a mercy to creation.`,
    refs: ref(21, 107) },
  { test: (m, d) => m === 7 && d === 27, badge: 'Commemoration', title: 'Isra & Miʿraj',
    significance: `This date is associated with the Night Journey and Ascension of the Prophet ﷺ, during which the five daily prayers were ordained.`,
    refs: ref(17, 1) },
];

// --- On this day in Islamic history (traditional dates; curated, expandable) ---
type History = { m: number; d: number; title: string; significance: string; refs: Ref[] };
const HISTORY: History[] = [
  { m: 9, d: 17, title: 'The Battle of Badr',
    significance: `Traditionally dated to 17 Ramadan, 2 AH — the first major battle, in which a small, outnumbered Muslim force prevailed by Allah's help.`,
    refs: ref(3, 123) },
  { m: 9, d: 20, title: 'The Conquest of Makkah',
    significance: `Traditionally dated to Ramadan, 8 AH — the Prophet ﷺ entered Makkah peacefully and cleared the Kaʿbah of its idols.`,
    refs: ref(110, 1, 2, 3) },
  { m: 10, d: 7, title: 'The Battle of Uhud',
    significance: `Traditionally dated to Shawwal, 3 AH — a hard test for the early Muslims, and a lasting lesson in patience and obedience.`,
    refs: ref(3, 139) },
];

// --- Reflective fallback pool (deterministic rotation) ---
// ~100 curated, wholly-uplifting verses for the daily reflection rotation
// (deterministic by date — see resolveToday). Self-contained ayat only:
// no warning tails, legal fragments, or out-of-context picks.
const REFLECTIVE: Ref[] = (
  [
    [2, 152], [2, 153], [2, 286], [3, 139], [3, 159], [13, 28], [14, 7], [16, 128], [39, 53], [65, 3],
    [94, 6], [67, 2], [49, 13], [17, 24], [25, 63], [103, 2], [64, 11], [8, 46], [2, 45], [29, 69],
    [93, 3], [6, 162], [31, 17], [4, 36], [23, 1], [51, 56], [2, 186], [2, 255], [55, 13], [76, 3],
    [7, 156], [6, 54], [42, 25], [25, 70], [25, 71], [110, 3], [24, 22], [23, 118], [7, 23], [40, 7],
    [94, 5], [93, 5], [12, 87], [2, 156], [65, 7], [21, 88], [13, 24], [16, 97], [41, 30], [3, 160],
    [9, 51], [64, 13], [11, 88], [47, 7], [16, 18], [31, 12], [3, 200], [16, 127], [39, 10], [42, 43],
    [90, 17], [33, 41], [29, 45], [50, 16], [57, 4], [2, 115], [2, 2], [17, 9], [41, 44], [10, 57],
    [54, 17], [16, 90], [41, 34], [3, 134], [25, 74], [2, 195], [28, 77], [2, 201], [3, 8], [20, 114],
    [14, 40], [30, 21], [3, 190], [2, 163], [59, 22], [112, 1], [87, 14], [91, 9], [13, 29], [16, 53],
    [27, 62], [11, 6], [8, 24], [73, 8], [92, 7], [94, 7], [3, 191], [49, 10], [60, 8], [10, 62],
  ] as [number, number][]
).map(([surah, ayah]) => ({ surah, ayah }));

function dayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

export function resolveToday(now: Date = new Date()): TodayInfo {
  const h = toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const monthName = HIJRI_MONTHS[h.hm - 1] ?? '';
  const hijri = { y: h.hy, m: h.hm, d: h.hd, monthName, label: `${h.hd} ${monthName} ${h.hy} AH` };
  const base = { hijri, gregorian: now };

  // 1) sacred / recurring (lunar caveat applies)
  for (const s of SACRED) {
    if (s.test(h.hm, h.hd)) {
      return { ...base, kind: 'sacred', badge: s.badge, title: s.title, significance: s.significance, caveat: LUNAR, refs: s.refs };
    }
  }
  // 2) on this day in history
  for (const e of HISTORY) {
    if (e.m === h.hm && e.d === h.hd) {
      return { ...base, kind: 'history', badge: 'On this day', title: e.title, significance: e.significance, caveat: LUNAR, refs: e.refs };
    }
  }
  // 3) weekly / monthly sunnah
  const dow = now.getDay(); // 0 Sun … 6 Sat
  if (dow === 5) {
    return { ...base, kind: 'weekly', badge: 'Jumuʿah', title: 'The Day of Jumuʿah',
      significance: `The best day of the week — a weekly gathering, and a special time for du'a and sending blessings on the Prophet ﷺ.`, refs: ref(62, 9) };
  }
  if (h.hd >= 13 && h.hd <= 15) {
    return { ...base, kind: 'weekly', badge: 'White Days', title: 'The White Days (Ayyam al-Beed)',
      significance: `The 13th–15th of each Hijri month — days the Prophet ﷺ encouraged voluntary fasting.`, refs: ref(2, 183) };
  }
  if (dow === 1 || dow === 4) {
    return { ...base, kind: 'weekly', badge: 'Sunnah fast', title: dow === 1 ? 'Monday' : 'Thursday',
      significance: `A day the Prophet ﷺ recommended voluntary fasting — deeds are presented to Allah on Mondays and Thursdays.`, refs: ref(2, 183) };
  }
  // 4) a verse to reflect on (never an "ordinary" day)
  return { ...base, kind: 'reflection', badge: 'Reflection', title: 'A verse to reflect on today',
    significance: 'Take a quiet moment with these words.', refs: [REFLECTIVE[dayNumber(now) % REFLECTIVE.length]] };
}
