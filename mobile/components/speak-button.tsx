import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useRecitation } from '@/lib/recitation-context';

const ACCENT = '#0a7ea4';
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

type SpeakState = 'idle' | 'loading' | 'playing';

/** Reads English text aloud via /api/speak (Andrew neural), with on-device speech as a fallback.
 *  Pauses the qāri first so audio never overlaps, and tears down on unmount. Reusable wherever we
 *  want a "read this aloud" control (verse explanations now, hubs later). */
export function SpeakButton({ text, size = 22 }: { text: string; size?: number }) {
  const recitation = useRecitation();
  const [state, setState] = useState<SpeakState>('idle');
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const mountedRef = useRef(true);

  const teardown = () => {
    try {
      subRef.current?.remove();
    } catch {}
    subRef.current = null;
    try {
      playerRef.current?.pause(); // pause BEFORE remove — removing alone can let the clip keep playing
    } catch {}
    try {
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
    Speech.stop();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, []);

  const stop = () => {
    teardown();
    if (mountedRef.current) setState('idle');
  };

  const play = async () => {
    const t = text.trim().slice(0, 1500);
    if (!t) return;
    haptic.light();
    recitation.pause(); // never overlap the qāri
    setState('loading');
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (!mountedRef.current) return;
      const player = createAudioPlayer(
        { uri: `${API_BASE}/api/speak?text=${encodeURIComponent(t)}` },
        { updateInterval: 300 },
      );
      playerRef.current = player;
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (!mountedRef.current) return;
        if (st.playing) setState('playing');
        if (st.didJustFinish) stop();
      });
      player.play();
    } catch {
      // network/endpoint failed → on-device voice
      if (!mountedRef.current) return;
      setState('playing');
      Speech.stop();
      Speech.speak(t, { rate: 0.95, onDone: stop, onError: stop });
    }
  };

  return (
    <Pressable
      onPress={() => (state === 'idle' ? void play() : stop())}
      hitSlop={10}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={state === 'idle' ? 'Read aloud' : 'Stop'}>
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={ACCENT} />
      ) : (
        <Ionicons name={state === 'playing' ? 'stop' : 'volume-high'} size={size} color={ACCENT} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.10)',
  },
});
