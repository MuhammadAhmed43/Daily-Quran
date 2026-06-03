import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { haptic } from '@/lib/haptics';
import { mdToPlain } from '@/lib/markdown';

// ChatGPT / Claude-style reveal: each word fades in (opacity 0→1). CRUCIAL: the fade only renders
// if each word is its own BLOCK-LEVEL flex child — animating opacity on inline nested <Text> does
// nothing in React Native. So we lay words out as boxes in a flexWrap row (the FlowToken approach).
const WORD_MS = 56; // ms between words (~18 words/s). Higher = slower/calmer.
const FADE_MS = 600; // how long each word fades — long + overlapping = dreamy, flowy.
const PARA_GAP = 6; // vertical gap inserted at a line/paragraph break

type Token = { type: 'word' | 'break'; text: string };

// One word (with trailing space), fading itself in on mount. Memoised so already-shown words never
// re-render as the list grows.
const FadeWord = memo(function FadeWord({
  text,
  color,
  style,
}: {
  text: string;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [a]);
  return <Animated.Text style={[{ color }, style, { opacity: a }]}>{text}</Animated.Text>;
});

/** Reveals `text` word-by-word with a soft per-word fade. When `final` is set and the reveal
 *  reaches the end, fires `onComplete` once (after the last fade settles) — same text, seamless. */
export function StreamingText({
  text,
  final,
  onComplete,
  style,
}: {
  text: string;
  final?: boolean;
  onComplete?: () => void;
  style?: StyleProp<TextStyle>;
}) {
  const color = useThemeColor({}, 'text');
  const tokens = useMemo<Token[]>(() => {
    const clean = mdToPlain(text); // strip markers (###, |, *, -) so the live reveal stays clean
    const out: Token[] = [];
    const lines = clean.split('\n');
    lines.forEach((line, i) => {
      for (const w of line.match(/\S+\s*/gu) ?? []) out.push({ type: 'word', text: w });
      if (i < lines.length - 1) out.push({ type: 'break', text: '' });
    });
    return out;
  }, [text]);
  const [revealed, setRevealed] = useState(0);

  const tokensRef = useRef(tokens);
  const finalRef = useRef(!!final);
  const onCompleteRef = useRef(onComplete);
  const revealedRef = useRef(0);
  const lastWord = useRef(0);
  const fired = useRef(false);
  tokensRef.current = tokens;
  finalRef.current = !!final;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let raf = 0;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const loop = () => {
      const total = tokensRef.current.length;
      const now = Date.now();
      if (revealedRef.current < total) {
        // hold a deliberate pace; only nudge faster if we've fallen a long way behind the buffer
        const backlog = total - revealedRef.current;
        const interval = backlog > 80 ? 30 : WORD_MS;
        if (now - lastWord.current >= interval) {
          lastWord.current = now;
          const starting = revealedRef.current === 0;
          revealedRef.current += 1;
          setRevealed(revealedRef.current);
          if (starting) haptic.light(); // a single tap as it begins
        }
      } else if (finalRef.current && !fired.current) {
        fired.current = true;
        settle = setTimeout(() => {
          haptic.light(); // a single tap as it finishes
          onCompleteRef.current?.();
        }, FADE_MS);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (settle) clearTimeout(settle);
    };
  }, []);

  return (
    <View style={styles.wrap}>
      {tokens.slice(0, revealed).map((tok, i) =>
        tok.type === 'break' ? (
          <View key={i} style={styles.break} />
        ) : (
          <FadeWord key={i} text={tok.text} color={color} style={style} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  break: { width: '100%', height: PARA_GAP },
});
