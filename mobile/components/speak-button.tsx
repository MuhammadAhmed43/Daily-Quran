import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useRecitation } from '@/lib/recitation-context';
import { c, font, radius } from '@/lib/theme';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

type SpeakState = 'idle' | 'loading' | 'playing';

/** Reads English text aloud via /api/speak (Andrew neural), with on-device speech as a fallback.
 *  Renders as a "Listen" pill, consistent with the app's audio controls. Pauses the qari first so audio
 *  never overlaps, and tears down on unmount. */
export function SpeakButton({ text, compact }: { text: string; compact?: boolean }) {
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
    recitation.pause(); // never overlap the qari
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

  const label = state === 'playing' ? 'Stop' : state === 'loading' ? 'Loading' : 'Listen';

  // Compact icon variant — for tight toolbars (e.g. under a chat answer).
  if (compact) {
    return (
      <PressableScale
        onPress={() => (state === 'idle' ? void play() : stop())}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel={state === 'idle' ? 'Read aloud' : 'Stop'}>
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={c.accent} />
        ) : (
          <Ionicons name={state === 'playing' ? 'stop' : 'headset-outline'} size={18} color={c.accent} />
        )}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={() => (state === 'idle' ? void play() : stop())}
      style={styles.pill}
      accessibilityRole="button"
      accessibilityLabel={state === 'idle' ? 'Read aloud' : 'Stop'}>
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={c.textPrimary} />
      ) : (
        <Ionicons name={state === 'playing' ? 'stop' : 'headset-outline'} size={17} color={c.textPrimary} />
      )}
      <Txt variant="caption" color={c.textPrimary} style={styles.label}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.sm,
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  label: { fontFamily: font.sansSemi, fontSize: 13 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
});
