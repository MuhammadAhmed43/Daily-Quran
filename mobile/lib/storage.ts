import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_READ_KEY = 'daily-quran:lastRead';

export type LastRead = { surah: number; ayah: number };

function parsePos(raw: string | null): LastRead | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.surah === 'number' && typeof v.ayah === 'number' ? { surah: v.surah, ayah: v.ayah } : null;
  } catch {
    return null;
  }
}

export async function getLastRead(): Promise<LastRead | null> {
  try {
    return parsePos(await AsyncStorage.getItem(LAST_READ_KEY));
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

// The whole-Qur'an "Listen" resume point — kept SEPARATE from lastRead (the reading position), so listening
// straight through never moves "Continue reading", and tapping an ayah to read never moves the listen point.
const LISTEN_KEY = 'daily-quran:listenPos';

export async function getListenPos(): Promise<LastRead | null> {
  try {
    return parsePos(await AsyncStorage.getItem(LISTEN_KEY));
  } catch {
    return null;
  }
}

export async function setListenPos(value: LastRead): Promise<void> {
  try {
    await AsyncStorage.setItem(LISTEN_KEY, JSON.stringify(value));
  } catch {
    // best-effort; ignore storage errors
  }
}
