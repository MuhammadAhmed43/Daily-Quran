// Journey step / lesson (Bible Chat frame 28 reading style, onyx). Eyebrow + serif title + serif framing
// -> the verse(s) as champagne verse cards (tap to explain, per-verse Listen) -> a Reflect prompt ->
// Mark complete -> Up next / Finish. The care step leads with a helpline. Re-skin only: the progress +
// recitation logic (completeStep, streak, ownsAudioRef fade-out, ExplainSheet) is unchanged.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SealMedallion } from '@/components/atlas-tile';
import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { FadeIn } from '@/components/fade-in';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { VerseSpeaker } from '@/components/verse-speaker';
import { haptic } from '@/lib/haptics';
import { getPlan, getStep } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';
import { planIcon } from '@/lib/plan-visuals';
import { getAyah, getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';
import { c, font, radius, space, type as ty } from '@/lib/theme';
import { useTranslation, verseText } from '@/lib/translations';

export default function StepPlayer() {
  const { id, order, play } = useLocalSearchParams<{ id: string; order: string; play?: string }>();
  const router = useRouter();
  const rec = useRecitation();
  const progress = usePlanProgress();
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [justDone, setJustDone] = useState(false);
  useTranslation(); // re-render the verses when the translation changes
  const ownsAudioRef = useRef(false);

  useEffect(() => {
    setJustDone(false);
  }, [order]);

  useEffect(() => {
    return () => {
      if (ownsAudioRef.current) rec.fadeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const plan = id ? getPlan(String(id)) : undefined;
  const step = plan ? getStep(plan.id, Number(order)) : undefined;

  // Entered via the Listen (headphone) button on the journey detail -> start narration here, inside the day.
  useEffect(() => {
    if (play === '1' && step && step.verses.length > 0) rec.playList(step.verses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  if (!plan || !step) {
    return (
      <Screen edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.fill, styles.center]}>
          <Txt variant="body" color={c.textMuted}>
            This step isn&apos;t available.
          </Txt>
          <PressableScale onPress={() => router.back()}>
            <Txt variant="caption" color={c.accent}>
              Go back
            </Txt>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  const total = plan.steps.length;
  const done = progress.isStepDone(plan.id, step.order) || justDone;
  const next = getStep(plan.id, step.order + 1);

  const playingNow = rec.playing;
  ownsAudioRef.current =
    rec.queued || (playingNow ? step.verses.some((v) => v.surah === playingNow.surah && v.ayah === playingNow.ayah) : false);
  const fadeIfMine = () => {
    if (ownsAudioRef.current) rec.fadeStop();
  };

  const complete = () => {
    if (done) return;
    haptic.success();
    progress.completeStep(plan.id, step.order);
    recordActivity('study_step');
    setJustDone(true);
  };

  return (
    <Screen edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <Txt variant="caption" color={c.textSecondary} numberOfLines={1} style={styles.headerTitle}>
          {plan.title}
        </Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeIn duration={500}>
          <Txt variant="eyebrow">
            Step {step.order} of {total}
          </Txt>
          <Txt variant="h1" style={styles.title}>
            {step.title}
          </Txt>
          <Txt style={styles.framing}>{step.framing}</Txt>
        </FadeIn>

        {step.care ? (
          <FadeIn delay={120}>
            <View style={styles.crisis}>
              <Txt variant="cardTitle" color={c.danger} style={styles.crisisTitle}>
                Please reach out — you matter
              </Txt>
              <Txt variant="body" color={c.textSecondary} style={styles.crisisText}>
                If you&apos;re in crisis or thinking about harming yourself, you don&apos;t have to face it alone. Contact
                your local emergency services or a crisis helpline right now, and talk to someone you trust. Reaching out
                is strength, and help is real.
              </Txt>
            </View>
          </FadeIn>
        ) : (
          step.verses.map((v, i) => {
            const a = getAyah(v.surah, v.ayah);
            const sr = getSurah(v.surah);
            if (!a || !sr) return null;
            return (
              <FadeIn key={`${v.surah}:${v.ayah}`} delay={120 + i * 70}>
                <PressableScale
                  style={styles.verse}
                  onPress={() => setExplainTarget({ surah: v.surah, ayah: v.ayah, name: sr.englishName, ar: a.ar, en: verseText(v.surah, v.ayah) })}>
                  <View style={styles.verseHead}>
                    <Txt variant="caption" color={c.accent} style={styles.ref}>
                      {sr.englishName} · {v.surah}:{v.ayah}
                    </Txt>
                    <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
                  </View>
                  <Txt style={[ty.verseAr, styles.ar]}>{a.ar}</Txt>
                  <Txt style={styles.en}>{verseText(v.surah, v.ayah)}</Txt>
                  <Txt variant="caption" color={c.accent} style={styles.explainHint}>
                    Tap to explain ›
                  </Txt>
                </PressableScale>
              </FadeIn>
            );
          })
        )}

        {step.verses.length >= 2 ? (
          <PressableScale
            style={styles.narrateBtn}
            onPress={() => {
              haptic.light();
              if (rec.queued) rec.stop();
              else rec.playList(step.verses);
            }}>
            <Ionicons name={rec.queued ? 'stop' : 'headset-outline'} size={16} color={c.accent} />
            <Txt variant="caption" color={c.accent} style={styles.narrateText}>
              {rec.queued ? 'Stop narration' : 'Listen to this step'}
            </Txt>
          </PressableScale>
        ) : null}

        <FadeIn delay={200}>
          <View style={styles.reflect}>
            <Txt variant="eyebrow">Reflect</Txt>
            <Txt style={styles.reflectText}>{step.reflection}</Txt>
          </View>
        </FadeIn>

        {step.note ? <Txt style={styles.note}>{step.note}</Txt> : null}

        <PressableScale onPress={complete} disabled={done} style={[styles.markBtn, done && styles.markDone]}>
          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? c.accent : c.bg} />
          <Txt style={[styles.markText, done && styles.markTextDone]}>{done ? 'Step complete' : 'Mark complete'}</Txt>
        </PressableScale>

        {done ? (
          <FadeIn duration={550}>
            {next ? (
              <PressableScale
                style={styles.nextBtn}
                onPress={() => {
                  haptic.light();
                  fadeIfMine();
                  router.replace({ pathname: '/plan/[id]/[order]', params: { id: plan.id, order: String(next.order) } });
                }}>
                <View style={styles.nextBody}>
                  <Txt variant="eyebrow">Up next</Txt>
                  <Txt variant="cardTitle" numberOfLines={1}>
                    {next.title}
                  </Txt>
                </View>
                <Ionicons name="arrow-forward-circle" size={30} color={c.accent} />
              </PressableScale>
            ) : (
              <View style={styles.finishCard}>
                <SealMedallion name={planIcon(plan.id)} frame={56} ring={42} glyph={26} glowStrength={0.3} />
                <Txt variant="h2" style={styles.finishTitle}>
                  You&apos;ve completed {plan.title}
                </Txt>
                <Txt variant="body" color={c.textSecondary} style={styles.finishText}>
                  May what you&apos;ve read stay with you through the day. When you&apos;re ready, another journey is
                  waiting.
                </Txt>
                <PressableScale
                  style={styles.cta}
                  onPress={() => {
                    haptic.light();
                    fadeIfMine();
                    router.replace('/plan');
                  }}>
                  <Txt style={styles.ctaText}>Explore journeys</Txt>
                </PressableScale>
              </View>
            )}
          </FadeIn>
        ) : null}

        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          An AI study aid for reflection — not a fatwa or a substitute for a qualified scholar.
        </Txt>
      </ScrollView>

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, paddingBottom: space.sm },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: font.sansMed },
  spacer: { width: 38 },

  scroll: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 16 },
  title: { marginTop: 8, lineHeight: 38 }, // generous so the ﷺ honorific (e.g. "Muhammad ﷺ ...") never clips when the title wraps
  framing: { fontFamily: font.serifReg, fontSize: 16.5, lineHeight: 26, color: c.scriptureInk, marginTop: 10 },

  crisis: { backgroundColor: 'rgba(217,89,76,0.10)', borderColor: 'rgba(217,89,76,0.35)', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 16, gap: 8 },
  crisisTitle: {},
  crisisText: { lineHeight: 21 },

  verse: { backgroundColor: c.surface1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, padding: space.card, gap: 8 },
  verseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontFamily: font.sansSemi, letterSpacing: 0.3 },
  ar: { color: c.scriptureInk, textAlign: 'right' },
  en: { fontFamily: font.serifReg, fontSize: 15.5, lineHeight: 24, color: c.scriptureInk },
  explainHint: { fontFamily: font.sansSemi },

  narrateBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 18, borderRadius: radius.full, backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  narrateText: { fontFamily: font.sansSemi },

  reflect: { backgroundColor: c.surface1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, padding: space.card, gap: 8 },
  reflectText: { fontFamily: font.serifReg, fontSize: 16.5, lineHeight: 25, color: c.scriptureInk },
  note: { fontFamily: font.serifItalic, fontSize: 14, lineHeight: 21, color: c.textMuted },

  markBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 16, borderRadius: radius.full },
  markDone: { backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  markText: { fontFamily: font.sansBold, fontSize: 16, color: c.bg },
  markTextDone: { color: c.accent },

  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  nextBody: { flex: 1, gap: 2 },

  finishCard: { alignItems: 'center', gap: 10, padding: space.card, borderRadius: radius.lg, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  finishTitle: { textAlign: 'center', lineHeight: 27 },
  finishText: { textAlign: 'center', lineHeight: 22 },
  cta: { backgroundColor: c.primary, paddingVertical: 13, paddingHorizontal: 24, borderRadius: radius.full, marginTop: 4 },
  ctaText: { fontFamily: font.sansBold, fontSize: 15, color: c.bg },

  disclaimer: { textAlign: 'center', lineHeight: 16, marginTop: 4 },
});
