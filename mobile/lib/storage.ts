import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_READ_KEY = 'daily-quran:lastRead';

export type LastRead = { surah: number; ayah: number };

export async function getLastRead(): Promise<LastRead | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_READ_KEY);
    return raw ? (JSON.parse(raw) as LastRead) : null;
  } catch {
    return null;
  }
}

export async function setLastRead(value: LastRead): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(value));
  } catch {
    // best-effort; ignore storage errors
  }
}
