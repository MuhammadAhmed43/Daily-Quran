// Real qāri recitation, streamed per-ayah from EveryAyah (free CDN — no key, no quota).
// We NEVER synthesize Qur'anic Arabic; only verified human recitations are played.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Reciter = { id: string; folder: string; name: string };

// Folder names are verified against everyayah.com and must match exactly (the CDN 404s
// otherwise). Each covers the full 6,236 ayat.
export const RECITERS: Reciter[] = [
  { id: 'alafasy', folder: 'Alafasy_128kbps', name: 'Mishary Rashid Alafasy' },
  { id: 'husary', folder: 'Husary_128kbps', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'abdulbasit', folder: 'Abdul_Basit_Murattal_192kbps', name: 'Abdul Basit Abdus-Samad' },
  { id: 'minshawi', folder: 'Minshawy_Murattal_128kbps', name: 'Mohamed Siddiq El-Minshawi' },
  { id: 'sudais', folder: 'Abdurrahmaan_As-Sudais_192kbps', name: 'Abdurrahman As-Sudais' },
  { id: 'tablaway', folder: 'Mohammad_al_Tablaway_128kbps', name: 'Mohammad al-Tablaway' },
];

export const DEFAULT_RECITER = RECITERS[0];

const pad3 = (n: number) => String(n).padStart(3, '0');

// EveryAyah layout: /data/<folder>/<SSS><AAA>.mp3  (e.g. 002255.mp3 = surah 2, ayah 255).
export function ayahAudioUrl(folder: string, surah: number, ayah: number): string {
  return `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

const RECITER_KEY = 'daily-quran:reciter';

export async function getPreferredReciter(): Promise<Reciter> {
  try {
    const id = await AsyncStorage.getItem(RECITER_KEY);
    return RECITERS.find((r) => r.id === id) ?? DEFAULT_RECITER;
  } catch {
    return DEFAULT_RECITER;
  }
}

export async function setPreferredReciter(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(RECITER_KEY, id);
  } catch {
    // best-effort; ignore storage errors
  }
}
