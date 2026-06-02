import * as Location from 'expo-location';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { qiblaDirection } from '@/lib/prayer';

const ACCENT = '#0a7ea4';
const ALIGNED = '#2e7d32';
const S = 300; // svg canvas
const C = S / 2; // center

export default function QiblaScreen() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const lat = params.lat ? Number(params.lat) : null;
  const lng = params.lng ? Number(params.lng) : null;
  const qibla = lat != null && lng != null ? qiblaDirection(lat, lng) : null;

  const [heading, setHeading] = useState<number | null>(null);
  const alignedRef = useRef(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let active = true;
    (async () => {
      try {
        const s = await Location.watchHeadingAsync((h) => {
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (deg >= 0) setHeading(Math.round(deg));
        });
        if (active) sub = s;
        else s.remove();
      } catch {
        // compass unavailable
      }
    })();
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);

  // Qibla angle relative to where the phone points, normalized to (-180,180] so 0 = aligned and
  // the needle never spins the long way round.
  const rel = qibla != null && heading != null ? ((qibla - heading + 540) % 360) - 180 : null;
  const aligned = rel != null && Math.abs(rel) < 5;
  const ready = qibla != null && heading != null && rel != null;
  const needleColor = aligned ? ALIGNED : ACCENT;

  useEffect(() => {
    if (aligned && !alignedRef.current) {
      alignedRef.current = true;
      haptic.medium();
    } else if (!aligned) {
      alignedRef.current = false;
    }
  }, [aligned]);

  // Tick marks around the rose (every 15°, longer at the cardinals).
  const ticks = [];
  for (let a = 0; a < 360; a += 15) {
    const major = a % 90 === 0;
    const rad = (a * Math.PI) / 180;
    const r1 = major ? 104 : 118;
    ticks.push({
      key: a,
      x1: C + r1 * Math.sin(rad),
      y1: C - r1 * Math.cos(rad),
      x2: C + 130 * Math.sin(rad),
      y2: C - 130 * Math.cos(rad),
      major,
    });
  }
  const cardinals = [
    { l: 'N', a: 0, color: '#d9534f' },
    { l: 'E', a: 90 },
    { l: 'S', a: 180 },
    { l: 'W', a: 270 },
  ].map((c) => {
    const rad = (c.a * Math.PI) / 180;
    return { ...c, x: C + 86 * Math.sin(rad), y: C - 86 * Math.cos(rad) };
  });

  // Kaaba marker sits at the needle's tip (upright overlay), so it's obvious which way is Qibla.
  const tipRad = ((rel ?? 0) * Math.PI) / 180;
  const tipX = C + 112 * Math.sin(tipRad);
  const tipY = C - 112 * Math.cos(tipRad);

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: 'Qibla', headerBackTitle: 'Prayer' }} />
      <SafeAreaView edges={['bottom']} style={styles.fill}>
        {qibla == null ? (
          <View style={styles.center}>
            <ThemedText style={styles.muted}>Open the Qibla compass from the Prayer tab.</ThemedText>
          </View>
        ) : (
          <View style={styles.center}>
            <View style={styles.dialWrap}>
              <Svg width={S} height={S}>
                <Circle cx={C} cy={C} r={138} fill="rgba(127,127,127,0.06)" />
                <Circle cx={C} cy={C} r={138} stroke="rgba(127,127,127,0.3)" strokeWidth={2} fill="none" />

                {/* rose rotates opposite the heading, so N points to true north */}
                <G rotation={-(heading ?? 0)} originX={C} originY={C}>
                  {ticks.map((t) => (
                    <Line
                      key={t.key}
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={t.major ? 'rgba(127,127,127,0.75)' : 'rgba(127,127,127,0.35)'}
                      strokeWidth={t.major ? 2.5 : 1}
                    />
                  ))}
                  {cardinals.map((c) => (
                    <SvgText
                      key={c.l}
                      x={c.x}
                      y={c.y + 6}
                      fontSize={18}
                      fontWeight="bold"
                      fill={c.color ?? 'rgba(140,140,140,0.9)'}
                      textAnchor="middle">
                      {c.l}
                    </SvgText>
                  ))}
                </G>

                {/* fixed forward marker (the way the phone points) */}
                <Polygon points={`${C},6 ${C - 9},24 ${C + 9},24`} fill="rgba(127,127,127,0.85)" />

                {/* needle: bold arrow to the Qibla, faint tail behind */}
                <G rotation={rel ?? 0} originX={C} originY={C}>
                  <Polygon points={`${C},${S - 44} ${C - 8},${C} ${C + 8},${C}`} fill="rgba(127,127,127,0.4)" />
                  <Polygon points={`${C},42 ${C - 14},${C + 4} ${C + 14},${C + 4}`} fill={needleColor} />
                </G>

                <Circle cx={C} cy={C} r={12} fill={needleColor} />
                <Circle cx={C} cy={C} r={5} fill="#fff" />
              </Svg>

              {ready ? (
                <ThemedText style={[styles.kaaba, { left: tipX - 13, top: tipY - 14 }]}>🕋</ThemedText>
              ) : null}
            </View>

            <ThemedText style={[styles.status, aligned && { color: ALIGNED }]}>
              {!ready
                ? 'Calibrating… move the phone in a figure-8'
                : aligned
                  ? 'Facing the Qibla 🕋'
                  : 'Turn until the arrow points up'}
            </ThemedText>
            {ready ? (
              <ThemedText style={styles.detail}>
                Qibla {Math.round(qibla!)}° from North · heading {heading}°
              </ThemedText>
            ) : null}
            <ThemedText style={styles.hint}>Hold the phone flat, away from metal & magnets.</ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  dialWrap: { width: S, height: S },
  kaaba: { position: 'absolute', width: 26, textAlign: 'center', fontSize: 22 },
  status: { fontSize: 19, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  detail: { fontSize: 14, opacity: 0.7, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12, opacity: 0.5, textAlign: 'center' },
  muted: { opacity: 0.6, textAlign: 'center' },
});
