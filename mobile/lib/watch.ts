// The "Watch" feature data: two chronological tracks of curated, embedded YouTube videos —
// the Seerah (life of the Prophet ﷺ) and the eras of Islamic history. Every youtubeId below was
// verified live + embeddable via YouTube oEmbed (scripts/verify-watch.mjs). Sources are
// Sunni-mainstream and DEPICTION-SAFE: lecture/cinematic narration (Mufti Menk, Yaqeen / Omar
// Suleiman) and documentaries — never a series that visually depicts the Prophet ﷺ.
// Durations are approximate (just for the badge); the player reads the true length at runtime.

export type Track = 'seerah' | 'history';

export type WatchVideo = {
  youtubeId: string;
  durationSec: number; // approximate — for the "12 min" badge only
  source: string; // channel, shown for transparency
  title?: string; // optional sub-title when a chapter has more than one video
};

export type Chapter = {
  id: string;
  track: Track;
  order: number;
  title: string;
  era: string; // short era/phase label, e.g. "Cave of Ḥirāʾ · 610 CE"
  blurb: string; // 1–2 lines
  videos: WatchVideo[]; // usually one
};

export const TRACKS: { key: Track; label: string; subtitle: string; accent: string }[] = [
  { key: 'seerah', label: 'Seerah', subtitle: 'Life of the Prophet ﷺ', accent: '#0a7ea4' },
  { key: 'history', label: 'History', subtitle: 'The eras of Islam', accent: '#c8a24a' },
];

export function trackAccent(track: Track): string {
  return TRACKS.find((t) => t.key === track)?.accent ?? '#0a7ea4';
}

const MENK = 'Mufti Menk'; // "Life of the Final Messenger" (2026) — cinematic, has background music
const YAQEEN = 'Yaqeen Institute';
const KG = 'Kings and Generals';
const ALJ = 'Al Jazeera · Science in a Golden Age';

const CHAPTERS: Chapter[] = [
  // ───────────────────────── Seerah ─────────────────────────
  {
    id: 'seerah-01', track: 'seerah', order: 1,
    title: 'The Year of the Elephant',
    era: 'Before Revelation · c. 570 CE',
    blurb: 'The world the Prophet ﷺ was born into, and the remarkable year that marked his birth.',
    videos: [{ youtubeId: 'PH61HNWHCyU', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-02', track: 'seerah', order: 2,
    title: 'The Orphan of Makkah',
    era: 'Childhood',
    blurb: 'Born an orphan and raised by his grandfather and uncle — the early years of his life.',
    videos: [{ youtubeId: 'kzIu3hrdqRM', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-03', track: 'seerah', order: 3,
    title: 'The Man Makkah Trusted',
    era: 'Youth · al-Amīn',
    blurb: 'Known as al-Amīn — "the Trustworthy" — long before he was called to prophethood.',
    videos: [{ youtubeId: 'Vdug1pNex54', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-04', track: 'seerah', order: 4,
    title: 'The First Revelation',
    era: 'Cave of Ḥirāʾ · 610 CE',
    blurb: 'In the solitude of Ḥirāʾ, the first words of the Qur’an descend: “Read.”',
    videos: [{ youtubeId: '6M-NQKRdNuM', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-05', track: 'seerah', order: 5,
    title: 'The Message Goes Public',
    era: 'The Open Call',
    blurb: 'After years of quiet teaching, the call to one God goes public — and meets resistance.',
    videos: [{ youtubeId: 'ntv3dJv8wqQ', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-06', track: 'seerah', order: 6,
    title: 'The Migration to Abyssinia',
    era: 'Persecution',
    blurb: 'As persecution deepens, a group of believers seeks refuge with a just Christian king.',
    videos: [{ youtubeId: 'qMmn1Lqh95M', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-07', track: 'seerah', order: 7,
    title: 'The Conversion of ʿUmar',
    era: 'A Turning Point',
    blurb: 'One of Makkah’s fiercest opponents becomes one of Islam’s greatest champions.',
    videos: [{ youtubeId: 'butrsoKNPz4', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-08', track: 'seerah', order: 8,
    title: 'The Year of Sorrow',
    era: 'Loss · Ṭāʾif',
    blurb: 'In one year the Prophet ﷺ loses both Khadījah and Abū Ṭālib — and is driven from Ṭāʾif.',
    videos: [{ youtubeId: 'hYndbxSMM6g', durationSec: 1500, source: `${MENK} · Seerah series` }],
  },
  {
    id: 'seerah-09', track: 'seerah', order: 9,
    title: 'The Night Journey — Isrāʾ & Miʿrāj',
    era: 'Jerusalem & the Heavens · 621 CE',
    blurb: 'After the year of grief, the Prophet ﷺ is taken by night to Jerusalem and ascends beyond.',
    videos: [{ youtubeId: 'YlVt1to1z5Y', durationSec: 1200, source: `${YAQEEN} · Omar Suleiman` }],
  },
  {
    id: 'seerah-10', track: 'seerah', order: 10,
    title: 'The Pledges of ʿAqabah',
    era: 'The Road to Madinah',
    blurb: 'Pilgrims from Yathrib pledge their loyalty — opening the door to the migration.',
    videos: [{ youtubeId: 'KrzPe8NrRd4', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-11', track: 'seerah', order: 11,
    title: 'The Hijra to Madinah',
    era: 'The Migration · 622 CE',
    blurb: 'The migration that begins the Islamic calendar and a new home for the believers.',
    videos: [{ youtubeId: 'qWubL2TGPlc', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-12', track: 'seerah', order: 12,
    title: 'The Brotherhood of Madinah',
    era: 'Building the Community',
    blurb: 'Migrants and helpers are bound together as brothers — the foundation of the new society.',
    videos: [{ youtubeId: 'cRmeK1tKuiY', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-13', track: 'seerah', order: 13,
    title: 'The Battle of Badr',
    era: 'The First Victory · 624 CE',
    blurb: 'Vastly outnumbered, the believers win their first and most decisive battle.',
    videos: [{ youtubeId: 'fH49JET37eY', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-14', track: 'seerah', order: 14,
    title: 'The Battle of Uhud',
    era: 'The Trials · 625 CE',
    blurb: 'A hard lesson in the second great battle, and a test of faith in the face of setback.',
    videos: [{ youtubeId: 'OTwmuzD-n2w', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-15', track: 'seerah', order: 15,
    title: 'The Battle of the Trench',
    era: 'The Confederates · 627 CE',
    blurb: 'Madinah is besieged by a vast alliance — and saved by strategy, patience, and resolve.',
    videos: [{ youtubeId: 'SNmETUE2GFA', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-16', track: 'seerah', order: 16,
    title: 'The Treaty of Ḥudaybiyyah',
    era: 'The Clear Victory · 628 CE',
    blurb: 'A treaty that looks like a setback proves to be a turning point — “a clear victory.”',
    videos: [{ youtubeId: 'FwbSkCofNA4', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-17', track: 'seerah', order: 17,
    title: 'The Conquest of Makkah',
    era: 'Victory · 630 CE',
    blurb: 'The Prophet ﷺ returns to the city that drove him out — not in vengeance, but in mercy.',
    videos: [{ youtubeId: 'TsjC5a7AwYU', durationSec: 480, source: MENK }],
  },
  {
    id: 'seerah-18', track: 'seerah', order: 18,
    title: 'The Farewell Pilgrimage',
    era: 'The Final Days · 632 CE',
    blurb: 'The final pilgrimage and sermon, as a complete message is entrusted to the world.',
    videos: [{ youtubeId: 'Ie8ebDeH7ck', durationSec: 480, source: MENK }],
  },

  // ───────────────────────── History ─────────────────────────
  {
    id: 'history-01', track: 'history', order: 1,
    title: 'Abū Bakr al-Ṣiddīq (ra)',
    era: 'The Rightly-Guided Caliphs · 632 CE',
    blurb: 'The closest companion becomes the first caliph, holding the young community together.',
    videos: [{ youtubeId: 'Rck2DlxxkTc', durationSec: 2400, source: `${YAQEEN} · The Firsts` }],
  },
  {
    id: 'history-02', track: 'history', order: 2,
    title: 'ʿUmar ibn al-Khaṭṭāb (ra)',
    era: 'The Rightly-Guided Caliphs · 634 CE',
    blurb: 'The convert whose justice and resolve reshaped a rapidly growing state.',
    videos: [{ youtubeId: 'x0f_VO0Weu4', durationSec: 2700, source: `${YAQEEN} · The Firsts` }],
  },
  {
    id: 'history-03', track: 'history', order: 3,
    title: 'ʿUthmān ibn ʿAffān (ra)',
    era: 'The Rightly-Guided Caliphs · 644 CE',
    blurb: 'The modest companion who gathered the Qur’an into one standard written text.',
    videos: [{ youtubeId: 'o9bx7Zw4PZ0', durationSec: 2400, source: `${YAQEEN} · The Firsts` }],
  },
  {
    id: 'history-04', track: 'history', order: 4,
    title: 'ʿAlī ibn Abī Ṭālib (ra)',
    era: 'The Rightly-Guided Caliphs · 656 CE',
    blurb: 'The fourth caliph — courageous, deeply learned, and steadfast through turbulent years.',
    videos: [{ youtubeId: 'In91yLh_WFU', durationSec: 2700, source: `${YAQEEN} · The Firsts` }],
  },
  {
    id: 'history-05', track: 'history', order: 5,
    title: 'The Umayyad Caliphate',
    era: 'Damascus · 661–750 CE',
    blurb: 'From Damascus, the Muslim world expands into an empire spanning three continents.',
    videos: [{ youtubeId: 'fc7-Ja26AqQ', durationSec: 1200, source: 'Casual Historian' }],
  },
  {
    id: 'history-06', track: 'history', order: 6,
    title: 'The Abbasids & the Golden Age',
    era: 'Baghdad · 750–1258 CE',
    blurb: 'Baghdad’s House of Wisdom ignites centuries of science, medicine, and learning.',
    videos: [{ youtubeId: 'O8hhwSn1iaU', durationSec: 3000, source: 'Epic History' }],
  },
  {
    id: 'history-07', track: 'history', order: 7,
    title: 'Astronomy: The Science of the Stars',
    era: 'The Golden Age of Science',
    blurb: 'How Muslim astronomers mapped the heavens — and named so many of the stars.',
    videos: [{ youtubeId: '3cVfyurIFvM', durationSec: 1440, source: ALJ }],
  },
  {
    id: 'history-08', track: 'history', order: 8,
    title: 'Optics: The True Nature of Light',
    era: 'The Golden Age of Science',
    blurb: 'Ibn al-Haytham and the birth of the experimental scientific method.',
    videos: [{ youtubeId: 'faQmHzY29Zc', durationSec: 1440, source: ALJ }],
  },
  {
    id: 'history-09', track: 'history', order: 9,
    title: 'Algebra & al-Khwārizmī',
    era: 'The Golden Age of Science',
    blurb: 'Al-Khwārizmī gives the world algebra — and lends his name to the word “algorithm.”',
    videos: [{ youtubeId: 'sAxWF_W6Q9w', durationSec: 1500, source: ALJ }],
  },
  {
    id: 'history-10', track: 'history', order: 10,
    title: 'Medicine: Al-Rāzī & Ibn Sīnā',
    era: 'The Golden Age of Science',
    blurb: 'The physicians whose Canon of Medicine taught the world for five centuries.',
    videos: [{ youtubeId: 'c8HlFFDTBWQ', durationSec: 1440, source: ALJ }],
  },
  {
    id: 'history-11', track: 'history', order: 11,
    title: 'Chemistry: The Great Search',
    era: 'The Golden Age of Science',
    blurb: 'From alchemy toward chemistry — the experiments that turned matter into a science.',
    videos: [{ youtubeId: 'uFAFZbrrCjA', durationSec: 1440, source: ALJ }],
  },
  {
    id: 'history-12', track: 'history', order: 12,
    title: 'The Rise of Muslim Spain',
    era: 'Al-Andalus · 756 CE',
    blurb: 'ʿAbd al-Raḥmān I founds an emirate in Córdoba that becomes a beacon of culture.',
    videos: [{ youtubeId: 'iHAcvlkeUZE', durationSec: 1200, source: KG }],
  },
  {
    id: 'history-13', track: 'history', order: 13,
    title: 'Salah al-Din & the Crusades',
    era: 'Jerusalem · 1187 CE',
    blurb: 'Salah al-Din unites the Muslim world and, after Ḥaṭṭīn, returns to Jerusalem in 1187.',
    videos: [{ youtubeId: 'kHTLBHt3zUM', durationSec: 1200, source: KG }],
  },
  {
    id: 'history-14', track: 'history', order: 14,
    title: 'The Mongol Sack of Baghdad',
    era: 'The Fall of Baghdad · 1258 CE',
    blurb: 'In 1258 the Mongols destroy Baghdad, ending five centuries of the Abbasid age.',
    videos: [{ youtubeId: '-3MPE2BWmBo', durationSec: 1140, source: KG }],
  },
  {
    id: 'history-15', track: 'history', order: 15,
    title: 'Rise of the Ottomans',
    era: 'The Ottomans · 1299 CE',
    blurb: 'From a small frontier principality to one of the great empires of history.',
    videos: [{ youtubeId: 'BlY5P6J3Zs8', durationSec: 1200, source: 'History Remaster' }],
  },
  {
    id: 'history-16', track: 'history', order: 16,
    title: 'The Fall of Constantinople',
    era: 'The Ottomans · 1453 CE',
    blurb: 'The 1453 conquest that closed the Byzantine age and opened a new chapter of history.',
    videos: [{ youtubeId: 'b7FIuZeqdEQ', durationSec: 1500, source: 'History documentary' }],
  },
  {
    id: 'history-17', track: 'history', order: 17,
    title: 'The Fall of Granada',
    era: 'Al-Andalus · 1492 CE',
    blurb: 'In 1492 the last Muslim kingdom in Spain surrenders, closing the story of al-Andalus.',
    videos: [{ youtubeId: 'j6hiITWBXpQ', durationSec: 1200, source: 'Empires Reawakened' }],
  },
];

export function getChapters(track: Track): Chapter[] {
  return CHAPTERS.filter((c) => c.track === track).sort((a, b) => a.order - b.order);
}

export function getChapter(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function neighbors(id: string): { prev?: Chapter; next?: Chapter } {
  const c = getChapter(id);
  if (!c) return {};
  const list = getChapters(c.track);
  const i = list.findIndex((x) => x.id === id);
  return { prev: list[i - 1], next: list[i + 1] };
}

export function ytThumb(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
