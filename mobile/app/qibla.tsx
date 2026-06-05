// QIBLA compass (onyx). A premium instrument on the dark canvas: a compass rose that counter-rotates to
// true north, a champagne needle to the Kaaba (with a Kaaba glyph at its tip), heading/bearing readout,
// and an aligned haptic. Onyx reskin only — the magnetometer + bearing geometry are unchanged.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { IconButton, Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { qiblaDirection } from '@/lib/prayer';
import { c, font, space } from '@/lib/theme';

const S = 300; // svg canvas
const C = S / 2; // center

export default function QiblaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const paramLat = params.lat ? Number(params.lat) : null;
  const paramLng = params.lng ? Number(params.lng) : null;

  // Coordinates may be handed in (from the Prayer screen) or fetched here (opened directly from Today).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    paramLat != null && paramLng != null ? { lat: paramLat, lng: paramLng } : null,
  );
  const [locDenied, setLocDenied] = useState(false);

  useEffect(() => {
    if (coords) return;
    let active = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (active) setLocDenied(true);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (active) setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        if (active) setLocDenied(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qibla = coords ? qiblaDirection(coords.lat, coords.lng) : null;

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
  const needleColor = aligned ? c.success : c.accent;

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
    { l: 'N', a: 0, color: c.danger },
    { l: 'E', a: 90 },
    { l: 'S', a: 180 },
    { l: 'W', a: 270 },
  ].map((card) => {
    const rad = (card.a * Math.PI) / 180;
    return { ...card, x: C + 86 * Math.sin(rad), y: C - 86 * Math.cos(rad) };
  });

  // Kaaba marker sits at the needle's tip (upright overlay), so it's obvious which way is Qibla.
  const tipRad = ((rel ?? 0) * Math.PI) / 180;
  const tipX = C + 112 * Math.sin(tipRad);
  const tipY = C - 112 * Math.cos(tipRad);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} bg={c.surface2} color={c.textPrimary} />
        <Txt variant="cardTitle">Qibla</Txt>
        <View style={styles.spacer} />
      </View>

      {qibla == null ? (
        <View style={styles.center}>
          {locDenied ? (
            <Txt variant="body" color={c.textMuted} style={styles.centerText}>
              Location is needed to find the Qibla. Enable location access in Settings.
            </Txt>
          ) : (
            <ActivityIndicator color={c.accent} />
          )}
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.dialWrap}>
            <Svg width={S} height={S}>
              <Circle cx={C} cy={C} r={138} fill="rgba(255,255,255,0.035)" />
              <Circle cx={C} cy={C} r={138} stroke="rgba(255,255,255,0.16)" strokeWidth={2} fill="none" />

              {/* rose rotates opposite the heading, so N points to true north */}
              <G rotation={-(heading ?? 0)} originX={C} originY={C}>
                {ticks.map((t) => (
                  <Line
                    key={t.key}
                    x1={t.x1}
                    y1={t.y1}
                    x2={t.x2}
                    y2={t.y2}
                    stroke={t.major ? 'rgba(201,189,166,0.7)' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={t.major ? 2.5 : 1}
                  />
                ))}
                {cardinals.map((card) => (
                  <SvgText
                    key={card.l}
                    x={card.x}
                    y={card.y + 6}
                    fontSize={18}
                    fontWeight="bold"
                    fill={card.color ?? 'rgba(240,237,230,0.85)'}
                    textAnchor="middle">
                    {card.l}
                  </SvgText>
                ))}
              </G>

              {/* fixed forward marker (the way the phone points) */}
              <Polygon points={`${C},6 ${C - 9},24 ${C + 9},24`} fill="rgba(240,237,230,0.85)" />

              {/* needle: bold arrow to the Qibla, faint tail behind */}
              <G rotation={rel ?? 0} originX={C} originY={C}>
                <Polygon points={`${C},${S - 44} ${C - 8},${C} ${C + 8},${C}`} fill="rgba(255,255,255,0.22)" />
                <Polygon points={`${C},42 ${C - 14},${C + 4} ${C + 14},${C + 4}`} fill={needleColor} />
              </G>

              <Circle cx={C} cy={C} r={12} fill={needleColor} />
              <Circle cx={C} cy={C} r={5} fill={c.textPrimary} />
            </Svg>

            {ready ? (
              <View style={[styles.kaaba, { left: tipX - 12, top: tipY - 12 }]} pointerEvents="none">
                <Ionicons name="cube" size={22} color={c.accentBright} />
              </View>
            ) : null}
          </View>

          <Txt style={[styles.status, aligned && { color: c.success }]}>
            {!ready ? 'Calibrating… move the phone in a figure-8' : aligned ? 'Facing the Qibla' : 'Turn until the arrow points up'}
          </Txt>
          {ready ? (
            <Txt variant="caption" color={c.textMuted} style={styles.detail}>
              Qibla {Math.round(qibla!)}° from North · heading {heading}°
            </Txt>
          ) : null}
          <Txt variant="caption" color={c.textMuted} style={styles.hint}>
            Hold the phone flat, away from metal & magnets.
          </Txt>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  centerText: { textAlign: 'center' },
  dialWrap: { width: S, height: S },
  kaaba: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  status: { fontFamily: font.serif, fontSize: 19, lineHeight: 26, color: c.textPrimary, textAlign: 'center', marginTop: 8 },
  detail: { fontVariant: ['tabular-nums'] },
  hint: { textAlign: 'center' },
});
