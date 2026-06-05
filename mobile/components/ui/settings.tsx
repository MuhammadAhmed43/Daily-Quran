// Settings + profile primitives (onyx) — the grouped-list language for the profile drawer and the
// settings sub-screens. Mirrors Bible Chat frames 19/29/32/33/35. See UI-REDESIGN-SPEC.md §3.5/§3.6.
//   StatCard          — a 2-up stat (flame + big serif number + label) for streaks/quiz
//   SettingsCard      — one rounded grouped container with inset hairline dividers between rows
//   SettingsRow       — icon/badge · title · subtitle · trailing chevron|value|custom-right
//   Toggle            — onyx-tinted iOS switch
//   SettingsHeaderRoot — big serif title + circular X (settings ROOTS: Account, About)
//   SettingsHeaderSub  — circular back-chevron + centered title (SUB-screens: Personalize, Reminders)
import { Ionicons } from '@expo/vector-icons';
import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Switch, View, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { c, font, glow, radius, space } from '@/lib/theme';

type Glyph = keyof typeof Ionicons.glyphMap;

/** #RRGGBB -> rgba() so a category color can fill a badge softly on the near-black canvas. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ───────────────────────────── StatCard (frames 19/29) ─────────────────────────────
export function StatCard({ icon, value, label, tint = c.streakFlame }: { icon: Glyph; value: string | number; label: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Ionicons name={icon} size={17} color={tint} />
        <Txt style={styles.statValue}>{value}</Txt>
      </View>
      <Txt variant="caption" color={c.textMuted} style={styles.statLabel}>
        {label}
      </Txt>
    </View>
  );
}

// ───────────────────────────── SettingsCard (frames 32/33/35) ─────────────────────────────
// Wraps rows in one rounded container and draws an inset hairline between consecutive rows.
// `dividerInset` aligns the hairline after a leading icon (set 0 for icon-less cards like Personalize).
export function SettingsCard({ children, dividerInset = 38, style }: { children: ReactNode; dividerInset?: number; style?: ViewStyle }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <View style={[styles.groupDivider, { marginLeft: space.card + dividerInset }]} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────────── SettingsRow ─────────────────────────────
export function SettingsRow({
  icon,
  badge,
  iconColor,
  title,
  subtitle,
  value,
  right,
  onPress,
  chevron,
  danger = false,
  disabled = false,
}: {
  icon?: Glyph;
  badge?: string; // a category color -> render the icon in a soft colored rounded-square
  iconColor?: string; // plain line-icon color (when no badge)
  title: string;
  subtitle?: string;
  value?: string; // right-aligned value text (picker rows)
  right?: ReactNode; // custom trailing element (e.g. a Toggle) — overrides value/chevron
  onPress?: () => void;
  chevron?: boolean; // force the trailing chevron on/off (defaults: on when onPress + no right)
  danger?: boolean;
  disabled?: boolean;
}) {
  const showChevron = chevron ?? (!!onPress && !right);
  const titleColor = danger ? c.danger : c.textPrimary;

  const inner = (
    <>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: withAlpha(badge, 0.16), borderColor: withAlpha(badge, 0.34) }]}>
          <Ionicons name={icon ?? 'ellipse'} size={18} color={badge} />
        </View>
      ) : icon ? (
        <Ionicons name={icon} size={21} color={iconColor ?? c.textSecondary} style={styles.lineIcon} />
      ) : null}
      <View style={styles.rowText}>
        <Txt style={[styles.rowTitle, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" color={c.textMuted} style={styles.rowSub}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ? (
        right
      ) : (
        <View style={styles.rowTrailing}>
          {value ? (
            <Txt variant="subtitle" color={c.accent} numberOfLines={1} style={styles.rowValue}>
              {value}
            </Txt>
          ) : null}
          {showChevron ? <Ionicons name="chevron-forward" size={17} color={withAlpha('#FFFFFF', 0.32)} /> : null}
        </View>
      )}
    </>
  );

  if (onPress && !disabled) {
    return (
      <PressableScale onPress={onPress} style={styles.row}>
        {inner}
      </PressableScale>
    );
  }
  return <View style={[styles.row, disabled && styles.rowDisabled]}>{inner}</View>;
}

// ───────────────────────────── Toggle ─────────────────────────────
export function Toggle({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: c.accent, false: 'rgba(255,255,255,0.16)' }}
      thumbColor={c.textPrimary}
      ios_backgroundColor="rgba(255,255,255,0.16)"
    />
  );
}

// ───────────────────────────── Headers ─────────────────────────────
function CircleBtn({ name, onPress, ring = false, size = 21 }: { name: Glyph; onPress: () => void; ring?: boolean; size?: number }) {
  return (
    <PressableScale onPress={onPress} style={[styles.circleBtn, ring && styles.circleBtnRing]}>
      <Ionicons name={name} size={size} color={c.textPrimary} />
    </PressableScale>
  );
}

/** Settings ROOT header: big serif title (left) under a top-right circular X. */
export function SettingsHeaderRoot({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.rootHeader}>
      <View style={styles.rootHeaderTop}>
        <CircleBtn name="close" onPress={onClose} size={20} />
      </View>
      <Txt style={styles.rootTitle}>{title}</Txt>
    </View>
  );
}

/** Settings SUB-screen header: circular back-chevron (gold ring) + centered title. */
export function SettingsHeaderSub({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.subHeader}>
      <CircleBtn name="chevron-back" onPress={onBack} ring size={22} />
      <Txt style={styles.subTitle} numberOfLines={1}>
        {title}
      </Txt>
      <View style={styles.subSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  // StatCard
  stat: {
    flex: 1,
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statValue: { fontFamily: font.serif, fontSize: 24, lineHeight: 28, color: c.textPrimary },
  statLabel: { letterSpacing: 0.2 },

  // SettingsCard
  group: {
    borderRadius: radius.lg,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    overflow: 'hidden',
  },
  groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginRight: space.card },

  // SettingsRow
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: space.card, minHeight: 56 },
  rowDisabled: { opacity: 0.45 },
  badge: { width: 34, height: 34, borderRadius: radius.badge, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  lineIcon: { width: 24, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: font.serif, fontSize: 16.5, lineHeight: 21 },
  rowSub: { lineHeight: 16 },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '46%' },
  rowValue: { flexShrink: 1, textAlign: 'right' },

  // headers
  circleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
  circleBtnRing: { borderWidth: StyleSheet.hairlineWidth, borderColor: c.accent, ...glow(c.accent, 0.18, 10) },

  rootHeader: { paddingHorizontal: space.gutter, gap: 12, marginBottom: space.sm },
  rootHeaderTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  rootTitle: { fontFamily: font.serif, fontSize: 32, lineHeight: 38, color: c.textPrimary },

  subHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.gutter, marginBottom: space.sm },
  subTitle: { flex: 1, textAlign: 'center', fontFamily: font.serif, fontSize: 18, lineHeight: 24, color: c.textPrimary },
  subSpacer: { width: 38 },
});
