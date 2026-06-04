---
name: ui-ux-redesign-master-spec-the-brain
description: "THE single source of truth for the Daily Qur'an dark-premium UI/UX redesign. If memory is wiped/compacted, READ THIS WHOLE FILE and you can deliver identically. Goal = rebuild the app's UI/UX/layout/animation to be NEAR-IDENTICAL to the Bible Chat app (the 8x reference) in a dark-premium emerald+gold skin. Reference screenshots: C:\\Quran-ChatApp\\Bible-chat\\ (layout/UX/motion source, 63 frames named by feature) + C:\\Quran-ChatApp\\Ui-Design\\ (color/aesthetic source, 20 frames). This is the make-or-break criterion for the take-home (a real job application)."
metadata: 
  node_type: memory
  originSessionId: 28448704-7434-4771-893a-9f0b6e2ba217
---

# DAILY QUR'AN — UI/UX REDESIGN MASTER SPEC ("THE BRAIN")

> HOW TO USE THIS FILE: This is the authoritative, self-contained spec for the entire visual/interaction redesign. Read it top to bottom after any compaction and you are fully back in action. Sections: 0 Mission+locked decisions · 1 Design tokens · 2 Navigation architecture · 3 Components · 4 Motion · 5 Screen teardowns (all 63 Bible Chat frames) · 6 Redesign map (BibleChat→ours) · 7 Ui-Design findings · 8 Technical · 9 Build plan+status. The actual screenshots are the ground truth — VIEW the relevant `C:\Quran-ChatApp\Bible-chat\NN)...png` frame before building each screen; this file tells you what to look for and how to translate it.

---

## 0. MISSION & LOCKED DECISIONS

**Mission.** The user's #1 criterion for the 8x take-home is UI/UX/layout/animation. Current app UI is judged "the worst." Reference best-seller = **Bible Chat** — its **layout, look/feel, UX, and (especially) its insanely smooth animations** are to be replicated **almost identically** for our Qur'an features. We do NOT copy its content/text or its light/cream color scheme. We DO copy: layout, component anatomy, navigation model, motion language, the "feel." Our features are analogous (chat, today/verse, community, reader, explore/plans) so the layouts transfer 1:1; only content + color change. "My life depends on this" — treat quality as paramount; device-review every screen; obsess over feel and motion.

**Color/aesthetic direction.** Dark, EXTREME PREMIUM, "screams premium." User gathered the `Ui-Design/` folder (gold-on-near-black) as the vibe but is unsure about it. My pixel-analysis verdict: the bones (gold on near-black, amber→bronze gradient, gold bilingual Arabic, 8-point seal medallions) are genuinely premium; the AI-default tells to FIX = over-bright "plastic honey" gold, anonymous default type, flat under-detailed cards, doily mandala backdrops, and NO semantic color layer (gold overloaded for accent+success+streak).

**LOCKED DECISIONS (user-confirmed):**
1. **PALETTE — recommendation = EMERALD + GOLD on near-black** (deep jewel emerald = identity/primary; gold = the sacred/AI "light" accent — voice burst, active tab, streak, key CTAs). Rationale: classical Qur'ans were illuminated with **gold leaf over deep jewel colors**; green = Islam + Paradise. Result reads as a **modern illuminated manuscript** — premium AND distinctive AND clearly Qur'an (vs generic gold-on-black). User said "show both" → **first build step = render the Today hero slice in BOTH emerald-gold AND refined amber-gold, device-test, user picks from real pixels.** Both palettes are fully tokenized in §1.
2. **TYPOGRAPHY — serif for scripture/titles + clean sans for UI + Uthmani Arabic.** (LOCKED) Serif carries the "premium/considered/editorial" feel (Bible Chat's biggest lever). Labels are UPPERCASE, letter-spaced, in gold.
3. **NAVIGATION — 5-tab bottom bar: Ask · Community · Today(center) · Qur'an · Explore.** (LOCKED, user-committed) Mirrors Bible Chat's Chat·Community·Today·Bible·Explore.
4. **START with the Today tab** (most-seen, demonstrates the most patterns) as the flagship proof screen. (User: "today is fine.")
5. **PROCESS:** Foundation (theme + components + motion primitives) → flagship **Today** in BOTH palettes → device review + tune feel → roll out tab by tab, user reviewing each on device. Preserve ALL existing logic (chat/quran/streak/sync/quiz/etc.) — this is a re-skin + re-layout, not a rewrite.

**Standing product guardrails still apply** (from the main memory): religiously sensitive, Sunni-mainstream; scripture rendered from the verified DB by ID (never LLM); no fatwas; depiction-safe (nothing depicting the Prophet ﷺ — so hero imagery is non-figurative: light, desert, geometry, sky, calligraphy, nature — NEVER people-as-prophets); crisis→helpline first; $0 infra; Expo SDK 54; Expo Go on iOS; Windows + physical iPhone (no Mac).

---

## 1. DESIGN SYSTEM — TOKENS

Implement as `mobile/lib/theme.ts` exporting a typed `theme` object (and a `useTheme()` if we ever support light, but we are DARK-ONLY). Two palettes are defined; ship behind a `PALETTE` switch so we can flip emerald↔amber for the A/B device test, then keep the winner.

### 1.1 COLOR — Palette A: EMERALD + GOLD (recommended lead)
```
// base / canvas
bg            #060807   // near-black, faintest green warmth (the canvas)
bgRaised      #0C1410   // page sections / behind cards
navBar        #0A0F0C   // bottom tab bar (near-black green), translucent + top hairline
// surfaces (elevation by lightness)
surface1      #121A16   // cards, rows
surface2      #1A241E   // elevated cards, sheets
surface3      #233029   // pressed / nested
// identity (emerald)
emerald       #1FA37A   // primary actions, identity, selected
emeraldDeep   #157A5A   // resting / gradient end
emeraldBright #2BBF90   // glow / hover
emeraldGrad   linear #1FA37A -> #0C3B2E  @135deg   // primary CTA / hero wash
// accent (gold = sacred/AI light)
gold          #E8B866   // AI sparkle, active tab, streak, key highlights
goldPressed   #C99A52
goldBright    #F2C97A   // glow core
goldGrad      linear #F0C079 -> #6E4E1C  @135deg   // illumination accents, voice light, gold CTAs
// text
textPrimary   #F2F4F1   // cool ivory
textSecondary #9DAEA6   // muted sage
textMuted     #5E6A64   // captions/meta
scriptureInk  #F4EFE2   // warm ivory for verse translation + Arabic on dark
// lines
hairline      rgba(255,255,255,0.08)
hairlineSoft  rgba(255,255,255,0.06)
glassLip      rgba(255,255,255,0.14)   // brighter top edge on glass
// semantic (DO NOT reuse gold for these)
success       #4FC58A
streakFlame   #E8A53A   // warm amber-orange (fire reads universally)
warning       #E0A21E
danger        #D9594C
info          #5B8DEF
// glow (lit-from-above, top ~140px radial)
glowTop       radial rgba(31,163,122,0.10) over rgba(232,184,102,0.06) -> transparent
// scrims
cardScrim     linear rgba(0,0,0,0) -> rgba(0,0,0,0.72)   // bottom->up on media cards
playerVignette top+bottom rgba(0,0,0,0.55) -> transparent
```

### 1.2 COLOR — Palette B: REFINED AMBER-GOLD (the Ui-Design direction, to also build for the A/B test)
```
bg            #060606
bgRaised      #0E0D0C
navBar        #0F0E13
surface1      #141414
surface2      #1E1E1E
surface3      #262626
gold          #E8B866   // primary AND accent (single warm accent)
goldPressed   #C99A52
goldBright    #F2C97A
goldGrad      linear #F0C079 -> #6E4E1C  @135deg
textPrimary   #F4F0E8
textSecondary #9A948A
textMuted     #5F5F5F
scriptureInk  #F5F1E8
hairline      rgba(255,255,255,0.08)
glassLip      rgba(255,255,255,0.14)
success       #5BBF8A
streakFlame   #E8A53A
warning       #E0A21E
danger        #D9594C
glowTop       radial rgba(232,184,102,0.10) -> transparent
```
Note: Ui-Design folder's literal sampled values were bg `#050505`, gold `#F0B975` (slightly too "plastic honey" — we deepen to `#E8B866`), layered surfaces `#141414→#1E1E1E→#292929`, navbar `#0F0E13`, pressed `#D0A16B`, bronze stop `#77531E`, muted `#5F5F5F`, silver secondary `#C0C0C0`.

### 1.3 CATEGORY COLOR-CODING (for Explore 2x2 tiles, topic cards, eyebrows)
Bible Chat color-codes content categories with **desaturated dark jewel tones** (premium, NOT neon): Meditations teal `#2C5F57`, Videos purple `#5B4B8A`, Study Plans blue `#2C5578`, Reading Plans terracotta `#7A4F43`. Keep a 4-6 hue coded palette but shift to our families. Our mapping (proposed): Stories `#5B4B8A` (purple), Watch `#2C5578` (blue), Journeys `#2C5F57` (teal), Qur'an-Plan `#7A4F43` (terracotta/bronze), Quiz `#6E5B8A`, Hubs `#3A6B5A`. Eyebrow tags reuse these per content type.

### 1.4 TYPOGRAPHY
Two-family system (THE premium lever). Load via `expo-font` (@expo-google-fonts) in `_layout.tsx` (we already load `AmiriQuran`; add the others).
- **SERIF (scripture, verses, titles, reflections, plan titles, questions):** **Fraunces** (display, has character + optical sizing) OR **Source Serif 4** (cleaner body). Recommend Fraunces for titles/display + Source Serif 4 for verse-translation body; if only one, use **Fraunces**. This is the "New York / Georgia"-class editorial serif that gives Bible Chat its voice.
- **SANS (all UI chrome: eyebrows, meta, chips, buttons, subtitles, placeholders, tab labels):** **Inter** (reliable, clean) or **Geist** (more premium/modern). Recommend **Inter**.
- **ARABIC (verse Arabic):** **AmiriQuran** (already bundled: `assets/fonts/AmiriQuran-Regular.ttf`). Uthmani. Keep. Large size, very generous line-height (~1.9-2.1x), right-aligned, RTL.

**Type scale (pt, dark theme):**
```
display      serif 600  34-40  lh 1.15   // splash hero, big moments
h1/title     serif 600  26-28  lh 1.2    // screen titles ("Today", plan titles)
h2/section   serif 600  20-22  lh 1.25   // section headers ("Explore Topics")
cardTitle    serif 500/600 16-17 lh 1.3  // card/row titles, verse refs
verseAr      AmiriQuran 22-26  lh ~2.0   // Arabic ayah (RTL)
verseEn      serif 400  16-18  lh 1.5    // translation (scriptureInk)
body         sans  400  15-16  lh 1.5    // textSecondary
subtitle     sans  400  13-14  lh 1.4    // textMuted
eyebrow/label sans 700  10-12  +1.2ls UPPERCASE  // GOLD or muted ("VERSE OF THE DAY","SEE ALL")
caption/meta sans  500  11-12  lh 1.3    // textMuted ~50%
button       sans  600  15-16            // CTA labels
```
Casing: section eyebrows + meta labels are UPPERCASE + letter-spaced (+1.0 to +1.4), usually gold or 50-60% white. Titles/content are sentence case serif.

### 1.5 SPACING (8pt base)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40+`. Screen horizontal gutter = **16** (20 for long reading text). Card inner padding = **14-16** (20 for plan/day/textarea cards). Section-to-section gap = **24-28**. Hero breathing room = **32**. Wizard steps use **deliberate large voids (40+)** for calm/premium. Card-to-card gap in lists = **16**; grid gutter = **10-12**; stat-card gutter = **8-12**.

### 1.6 RADIUS
```
full   // pills, chips, circular buttons, FABs, toggles, stepper +/- , the Ask glass pill
24     // bottom-sheet top corners, big feature cards (VOTD)
20     // plan/day/loader/textarea cards, large media/hero cards
16     // content/media cards, grouped settings cards, list cards
14     // inputs, stat cards
12     // list thumbnails, "N DAYS" badges
9-10   // small icon badges (rounded-square)
```

### 1.7 ELEVATION / SHADOW / GLOW
- **Card shadow (soft, low):** y6-8, blur20-24, color black @25-35%. Most cards rely more on **1px hairline border** (`hairline`) than shadow.
- **Glass lip:** top 1px edge brighter (`glassLip`) to fake light catching the glass.
- **GOLD GLOW (key CTAs, active tab, voice light, selected chips):** shadowColor = gold, shadowOpacity ~0.30, shadowRadius ~16, y0; on Android use elevation + a faint gold border. Use SPARINGLY — it's the "premium spark."
- **Emerald glow (primary CTA in Palette A):** same recipe with emerald.

### 1.8 GLASSMORPHISM (signature)
The floating Ask pill + frosted sticky headers + glass badges. Recipe:
- `expo-blur` `<BlurView intensity={45-60} tint="dark">` clipped to the shape.
- Underlay fill `rgba(surface2, 0.55)`.
- 1px hairline border `hairline`; top edge `glassLip` (brighter).
- Soft shadow y6 blur20 black/30 to float it.
- It must sit ABOVE scrolling content and sample live (content scrolls behind, blur updates). Works in Expo Go.

### 1.9 WARM "LIT-FROM-ABOVE" GLOW (on every screen top)
A subtle radial/linear gradient at the top ~120-160px fading to transparent — the signature ambient. `expo-linear-gradient` (or a RadialGradient via `react-native-svg`): from `glowTop` colors → transparent. Content "melts" into it under blur-sticky headers (see §4 header behaviors). Emerald+gold mix in Palette A; warm amber in Palette B.

### 1.10 MOTION TOKENS
```
dur.micro   150ms   // press, toggle
dur.base    250-300 // entrances, crossfades
dur.step    280-350 // wizard step swap
dur.sheet   420-480 // bottom-sheet slide-up (spring)
ease.out    Easing.out(Easing.cubic)   // entrances
ease.inout  Easing.inOut(Easing.cubic)
spring.sheet  { damping ~18, stiffness ~140, mass 1 } // gentle overshoot, settles clean (no wobble)
spring.press  { damping ~15, stiffness ~300 }
stagger.chip  30-40ms
stagger.card  60-80ms
press.scale   0.96-0.97  + haptic.light()
shimmer       1.1-1.4s loop linear, diagonal ~20deg band, phase-stagger 120ms across a grid
```
Library stack (see §8): **react-native-reanimated v3** (already installed) for all transforms/timelines; **@gorhom/bottom-sheet** for sheets/wizard; **expo-blur** for glass; **expo-linear-gradient** for gradients/scrims/shimmer; **expo-haptics** (already used) for press feedback; optional **moti** for terse stagger/AnimatePresence; optional **lottie-react-native** for the splash/voice/glow emblem.

### 1.11 ICONOGRAPHY
Thin **line** icons (Feather / SF-Symbol style, 1.5-2px stroke) for inactive/UI; **filled + gold** for active/accent. Use `@expo/vector-icons` (Ionicons + Feather already in repo). Category badges = colored rounded-square (radius 9-10) holding a line icon. The AI "ask" affordance = a 4-point **sparkle/star** in gold. Streak = flame (filled, `streakFlame`). Custom art: the **voice radial sunburst** (Skia/SVG), the **splash sun-bloom**, **8-point seal/medallion** motifs.

---

## 2. NAVIGATION ARCHITECTURE

### 2.1 The 5-tab bottom bar (LOCKED)
Order L→R, **Today centered**: **Ask · Community · Today · Qur'an · Explore.**
- **Ask** (speech-bubble icon) — grounded AI chat: the glass Ask pill, "Explore Topics" grid, history, image/reflect, voice. = Bible Chat "Chat".
- **Community** (people/group icon) — Ameen wall + live du'as + Islamic/world events feed. = "Community".
- **Today** (center, sun/asterisk-burst icon, the brand mark) — verse of the day, reflection, prayer tracker, week-streak chart, progress. = "Today".
- **Qur'an** (open-book icon) — reader, surah index, reciter, bookmarks. = "Bible".
- **Explore** (compass/grid icon) — 2x2 hub → Stories · Watch · Journeys/Plans · Quiz, carousels, search. = "Explore".

**Tab bar style:** translucent near-black (`navBar`) with a top hairline; can be a floating rounded bar OR full-width with hairline (Bible Chat uses full-width + hairline; Ui-Design hints a floating rounded bar — pick full-width hairline first, it's safer). Active tab = **gold** filled icon + gold label; inactive = `textMuted` (~55%) line icons. Labels ~10pt sans below icons. The center **Today** can be slightly emphasized (larger / a subtle gold ring) since it's the brand sun. **Tab bar is HIDDEN on immersive/stack screens** (reader full-screen, ask conversation, voice, history, sheets, settings, plan detail, wizard).

### 2.2 Three overlay archetypes
1. **Left slide-over drawer** (Profile/account hub) — opens from the top-left avatar; translateX 0→full, parent dims + slightly scales/parallax; right edge of parent peeks. Holds: streak stat cards, color-coded grouped menu (Your Verses / Trivia=Quiz / Holy Calendar / Blessing Partner / Widgets), emotional photo upsell, footer settings (Subscription/About/Account).
2. **Bottom sheets** (with grab handle + scrim dim of parent) — voice picker, topic suggested-questions, trivia/quiz modes, the **personal-plan wizard**, pickers. Top radius 24, surface2, grab handle, rows stagger-fade in. Use `@gorhom/bottom-sheet`.
3. **Pushed stack screens** (slide-in from right) — Ask conversation, Voice, History, event/article detail, plan detail, settings sub-screens. Back affordance = **ghost circle with a back chevron** (top-left). Settings ROOTS use a **circular X top-right + big left-aligned bold title**; settings SUB-screens use **circular back-chevron top-left + centered medium title**.

### 2.3 Header behaviors (3 modes — use contextually)
- **Blur-sticky + warm glow** (Explore root, Meditations/content libraries, Today): a persistent translucent header with the warm top-glow + **progressive blur**; body content **melts/dissolves into the top glow** as it scrolls under (frame 51 "blurred-out top"). `expo-blur` + a top gradient mask.
- **Collapse-on-scroll** (plan detail, watch series, article): nav **transparent over the hero image → condenses to solid bg + centered serif title + hairline divider** as you scroll; hero image **parallax** (slower translate) + may Ken-Burns.
- **Tap-to-expand** (watch series header, frame 46): the hero **slides down/expands** (accordion) to reveal About + Play-All + collections.

### 2.4 Route reorganization (Expo Router)
Current tabs: `app/(tabs)/index.tsx, today.tsx, prayer.tsx, chat.tsx, stories.tsx` + many stack screens (`surah/[number]`, `hub/[id]`, `watch`, `plan/...`, `quran-plan/...`, `reading/...`, `ameen`, `profile`, `quiz`, `qibla`, `voice`, `bookmarks`, `auth`). REORG to the 5 tabs:
- `(tabs)/today.tsx` = Today (center). `(tabs)/chat.tsx` → rename concept to **Ask**. New `(tabs)/community.tsx` (Ameen + live + events). New `(tabs)/quran.tsx` (reader entry / surah index — likely wraps existing surah list). `(tabs)/explore.tsx` (new hub; absorbs stories/watch/journeys/quran-plan/quiz/hubs as carousels + 2x2). Update `(tabs)/_layout.tsx` tab order + icons + styling. Keep all existing stack screens; restyle them. The prayer tracker moves INTO Today (a card/section) or stays a sub-screen reached from Today. NOTE: preserve all logic/hooks; only move/rename presentation.

---

## 3. SIGNATURE COMPONENTS (build these first, in `components/ui/`)

All radii/spacing/colors reference §1 tokens. Every tappable gets press-scale 0.96-0.97 + `haptic.light()`.

### 3.1 GlassPill (THE signature — the Ask bar)  [frame 15]
Floating, backdrop-blurred input pill. Pinned ABOVE the tab bar with a gap (inset ~12px each side), or docked above the keyboard on the Ask screen.
- Shape: full pill, height ~52. Fill `rgba(surface2,0.55)` + `<BlurView intensity={50} tint="dark">`. Border 1px `hairline`, top edge `glassLip`. Shadow y6 blur20 black/30.
- Contents L→R: **gold sparkle icon** (~18, the AI affordance) · placeholder "Ask about the Qur'an..." (`textMuted`) · **mic icon** (~20, near-white, trailing).
- Must float over scrolling content and sample live. Tapping it → push to the Ask conversation screen (the pill "lifts/docks").

### 3.2 MediaCard (photographic content card)  [frames 37-50, 52-54]
- Photographic fill (non-figurative imagery only — light/desert/sky/geometry/nature, NEVER depicting prophets). Radius 16-22 (hero 20-24, rail 16-18). `cardScrim` bottom→up for legibility.
- **Glass "✦" badge top-left** (frosted pill, tiny UPPERCASE, leading sparkle/▷ glyph): category or duration ("✦ WATCH", "✦ 4 MIN", "✦ YOUR PLAN", "7 DAYS").
- **Serif title overlaid bottom-left**; optional meta/timecode beneath.
- **Featured** variant: + floating **circular play button bottom-right** (light fill, dark triangle), half-overlapping the lower edge.
- Aspect: hero ≈16:10, featured ≈16:9, rail 2-up ≈3:2/square, list-thumb ≈1:1 (radius ~10).
- "Continue" video variant: + thin **progress bar** pinned to bottom edge + timecode ("0:51 • 0:54").

### 3.3 SectionHeader  [everywhere]
Row: **bold serif label left** (~16-17 "Explore Topics") + **tiny UPPERCASE muted/gold "SEE ALL" right** (~11, +0.6ls, tappable). ~24-28 above each section.

### 3.4 Chip — two kinds
- **Filter chip** (history, meditation topics): pill, ~34 tall. Inactive = 1px `hairline` border + transparent + ~80% text; **active = solid light/gold fill + dark text**. Horizontal scroll, ~8px gap.
- **Selectable chip** (wizard topic multi-select): pill, leading mini line-icon + sans label. Unselected = transparent + 1px white-25 border + white-80. **Selected = accent (gold/emerald) fill + white + soft glow + check/filled-icon.** Multi-select cap (≤5) → over-cap chips dim/disable; tap = fill-in animation + haptic.

### 3.5 SettingsCard (grouped list)  [frames 32,35]
iOS-grouped style: ONE rounded container (radius 16-18, `surface1` fill, 1px hairline border) with **inset hairline dividers** (start after the leading icon). Two row archetypes:
- **Icon · Label · Chevron** (navigation rows): leading line-icon (or colored rounded-square badge) ~22-34, label serif ~16-17, trailing chevron `›` ~40% — row height ~56-58.
- **Title / Subtitle (+ optional toggle)** (preference rows): title bold ~17 + subtitle muted ~14; inline toggle for booleans, picker (chevron) for enums.
Settings ROOT = big left bold title (~32-34) + circular X top-right + optional grey version/UID footer. SUB-screen = circular back-chevron top-left + centered title (~18).

### 3.6 StatCard  [frames 19,29]
2-up equal cards (radius 14, `surface1`, hairline). Each: icon (flame=`streakFlame`) + **big serif number** (~22) on one line + label sans ~12 muted below. Used for streak (Current/Longest), quiz stats, etc.

### 3.7 BottomSheet  [frames 18,20,21,56-62]
`@gorhom/bottom-sheet`. Top radius 24, `surface2`, grab handle (centered short bar), faint top glow. Parent dims (scrim 0→0.5) + slightly scales (1→0.94) behind. Rows/content **stagger-fade in**. Detents as needed. The **wizard** is a near-full-height sheet (§5).

### 3.8 SkeletonShimmer  [frames 25,53]
Clipped rounded block (`surface1` base, radius matching the real card). A linear-gradient band `transparent → rgba(255,255,255,0.08) → transparent` sweeps **left→right, ~20° diagonal**, 1.1-1.4s loop linear, **phase-staggered 120ms** across a grid so it shimmers in a wave. On data load → **crossfade** skeleton→real image (200ms) + image fade 0→1 + optional 1.02→1 settle. NEVER a dead full-screen spinner.

### 3.9 AnalyzingLoader (the relay)  [frames 60,61]
The "make it feel bespoke" loader. Centered **app emblem** (rounded-square ~88, gradient art, soft GOLD GLOW, **pulse 1↔1.05 + halo breathing ~2s loop**). **Serif heading** that **crossfades** to mirror the active task. **3 stacked progress rows** (radius 20, translucent): active row = brighter + **count-up %** (eased, slightly irregular jumps to feel real) + **determinate bar** filling along its bottom (leading-edge gold glow); on 100% → bar locks + **check-circle pops in** (scale 0.6→1) + next row brightens (relay). Pending rows ~40% opacity. Scripted ~3-5s timeline (or gate on real backend). Our emblem = an 8-point gold seal / lantern / mihrab glyph (NOT figurative).

### 3.10 Calendar  [frames 25-29]
7-col grid. Month header (`‹ Month YYYY ›`, centered serif title, edge chevrons in ghost circles) → 7-col UPPERCASE weekday row (~11, tracked, muted) → 6-row date grid. **Date cell = circle ⌀~32**, states: **filled-accent** (has content / streak-complete), **grey-ring** (ordinary), **ring-halo** (today), **bright-ring** (selected, brighter gold/emerald), **flame** (streak-complete in streak mode). Selection drops a **date label + significance card** beneath the grid (slide-up + fade ~250ms; switching dates cross-fades the card text). Loading = ring outlines first → **staggered per-cell accent fill + numeral fade-in, row-by-row**. **Dual-pill top toggle** switches modes (Holy Calendar ↔ Daily Streak) WITHOUT leaving — independent pills (not a connected segment): active = light/gold pill + dark text, inactive = translucent + light text.

### 3.11 DayTimelineCard (plan/journey day)  [frames 41,55,63,64]
Vertical list of Day cards (radius 20, `surface1`, hairline) linked by a **dotted vertical spine** (low-opacity, no trailing dot on last). Each card: tiny "Day N" label (muted) + optional **"Continue here" accent pill** (resume marker) + **serif lesson title** + right-side **two circular buttons: headphones (Listen) + open-book (Read)** (~40, `surface3`, line icon white-80). For us: Listen = recite-audio, Read = tafsir/ayah. Cards **stagger-rise** on reveal.

### 3.12 Stepper / Textarea / Toggle / ReminderRow  [frames 58,59,62,34]
- **Stepper:** big **−** circle (left) · huge serif numeral center + unit below · **+** circle (right). Circles ~64, transparent + 1px white-30 border; press → accent ring fill + scale 0.92. Numeral change = quick odometer roll / scale-punch + haptic. Clamp min/max.
- **Textarea:** rounded-20 translucent panel (`rgba(255,255,255,0.07)`), padding 16, placeholder white-45, text white-95; focus brightens edge + KeyboardAvoiding.
- **Toggle:** iOS pill; OFF = grey track; **ON = accent (gold/emerald) track**, knob slides.
- **ReminderRow:** hero **large serif time numeral** (~36) + weekday chips (7 small rounded-square chips, selected = accent fill) + "Daily until <date>" subline + per-item toggle.

### 3.13 PrimaryButton / SecondaryButton / CTA language
- **Primary (max emphasis):** in Bible Chat = **white/light pill, dark text, full-width** ("Start Plan ›", "Play All", "Ask your own question"). For our premium dark skin, KEEP a high-contrast pill but consider **gold-gradient fill with dark text** OR **near-white** — TEST both; white = strongest contrast, gold = most premium. Trailing `›` chevron on forward actions. Full-width minus 16 gutter, ~56 tall, radius full. Soft upward shadow + optional gold glow.
- **Secondary:** **outlined pill, transparent fill, 1px hairline border, centered label** ("See All Clips").
- **Circular action buttons:** dark circle + light glyph (play, headphones, book, back, close); the **white mic** (voice active) is opaque white.

---

## 4. MOTION LANGUAGE (the "insanely smooth" — this is what wins)

Implement with Reanimated v3 (`entering`/`exiting`, shared values, `withSpring`/`withTiming`/`withRepeat`), moti optional for terse stagger. EVERY tappable: press-scale 0.96-0.97 + `haptic.light()`.

### 4.1 Splash / launch sequence  [frames 1,2]
Cold launch from near-black: **app-icon mark fades in centered** → a **warm sun/light bloom glows in from top-left** → screen "lights up" revealing the day's verse → transitions into Today. Implement: black screen, emblem fade/scale-in (0.8→1), a radial gold bloom (animated opacity/scale from top-left), then a cross-fade/upward reveal of the verse, then route to Today. (Lottie or Reanimated.) Hold native splash until fonts+ready, then run this.

### 4.2 Bottom-sheet slide-up (the modal language)  [frames 56, all sheets]
Sheet translates Y `+screenH → 0` with `spring.sheet` (gentle overshoot, settles clean — NO wobble), ~450ms; parent **dims (scrim 0→0.5) + scales 1→0.94** behind (iOS card feel). After it lands (~70% travel), inner content **staggers in** (emblem→title→subtitle→CTA, ~60-90ms apart, +8px drift). Swipe-down to dismiss (rubber-band).

### 4.3 Per-step crossfade + drift (wizard/question swap)  [frames 57-62]
Outgoing content fades + drifts up/left; incoming fades + drifts in (~280-350ms ease-out). Sheet container stays; only inner content swaps. Use `AnimatePresence` / `FadeInRight`+`FadeOutLeft`.

### 4.4 Stagger-in cascade  [chips, cards, timeline, lists]
Items fade + rise (+8-10px) + tiny scale (0.96→1), staggered (chips 30-40ms, cards/timeline 60-80ms) in reading order. `FadeInDown.delay(i*n)` or moti `delay`.

### 4.5 Skeleton shimmer — see §3.8. (Two loaders only; never a dead spinner.)
### 4.6 Relay analyzing loader — see §3.9.

### 4.7 Finished-page reveal (triumphant)  [frame 63]
A fresh full screen **rises + fades + scales 0.96→1** into place (~500ms spring); header image Ken-Burns (1.05→1); content staggers (title→badges→body→**day cards cascade down the timeline**, spine "drawing" downward); "Continue here" pill pulses once. Custom route transition + per-item `FadeInDown.delay(i*70)`.

### 4.8 Header behaviors — see §2.3 (blur-sticky melt / collapse-on-scroll parallax / tap-to-expand accordion).

### 4.9 Today "sliding window" between cards  [frames 3,5,8,9,10]
The Today verse/reflection/prayer present as a **vertically sliding window** — tapping a card **beautifully opens it** (expands / pushes) revealing its full content + a **bottom options bar**; the set slides top↔bottom as a window. (VIEW frames 3,4,5,8,9,10 at build time.) Implement as expand/collapse with shared-element or a slide + the others making room; bottom options bar fades up.

### 4.10 Voice radial "divine-light" visualizer  [frame 17]
Center radial **sunburst** — N thin gold rays around a bright glowing core; rays **pulse/scale + slow rotation**, core **breathes**, amplitude-reactive to live mic. "I'm listening..." with ellipsis pulse. White mic = active (opaque white circle), grey X = cancel (spatially separated). Skia/SVG + Reanimated (or Lottie). Voice-picker sheet (Try-to-preview rows) from a top waveform icon.

### 4.11 Press feedback / micro
Everywhere: scale 0.92-0.97 + fill flash + `haptic.light()` (or `success` on completion). Toggles animate knob+track. Number changes odometer-roll. Selection chips fill-in. Favorite stars fill animation.

---

## 5. SCREEN TEARDOWNS (all 63 Bible Chat frames, by area)

> Source images: `C:\Quran-ChatApp\Bible-chat\NN)<desc>.png`. The filename = the screen + the interaction/animation. VIEW the frame before building. Global frame: iPhone notch/Dynamic-Island; serif=content, sans=UI; dark warm-tinted near-black; ONE saturated accent. (Full agent-1 home teardown also persisted at the session tool-results JSON if needed.)

### 5.A TODAY / HOME + COMMUNITY start (frames 1-13)
- **1 Splash beat 1:** cold launch from near-black; app-icon mark fades in centered; warm **sun/light bloom** glows from top-left. Timed, non-interactive.
- **2 Splash beat 2:** sun + screen "lights up" revealing the day's verse → transitions into Today. (See §4.1.)
- **3 HOME/TODAY (the core):** top→bottom = status bar · **week-streak chart** (7 day chips, clickable, shows per-day progress, dated e.g. "Jun 3") · **Verse of the Day** card · **Reflection** card · **My Prayer** card · streaks + progress. The 3 content cards form a **vertical sliding window**. Serif verse, warm. THIS is build-target #1.
- **4 Prayer opens:** tapping My Prayer **beautifully expands** vs scr 3 — full prayer view + bottom options.
- **5 Sliding window:** verse/reflection/my-prayer slide top↔bottom as a window (reflection state vs scr 3) — the signature Today motion.
- **6 Week chart:** the top 7-day chart is **clickable**, shows progress for a given day (Jun 3).
- **7 Verse changes with the day** (date-driven content).
- **8 Your Verse opens + bottom options** (share/save/read-in-context/ask style row).
- **9 Reflections open + bottom options.**
- **10 My Prayer opens + bottom options.**
- **11 Community:** feed of community posts/prayers + options. (→ our Ameen wall.)
- **12 Live Prayers:** live/active prayers list + options. (→ our live du'as.)
- **13 World Events tab** inside Community: a feed of dated events. (→ Islamic calendar/world events.)
- **Today build map:** week-streak chart (uses our `streak.ts`), VOTD card (our `daily-verse`), Reflection (our check-in/journal), My Prayer (our `prayer-log`), each tap-to-expand with a bottom options bar; sliding-window motion (§4.9).

### 5.B ASK/CHAT · VOICE · PROFILE · TRIVIA · HISTORY (frames 14-24)
- **14 World-event reading detail:** immersive serif long-read, tab bar hidden, collapsing parallax header, finishing-stats footer ("14,552 prayed"). Citation styled distinct from prose.
- **15 ★ CHAT/ASK tab (signature):** top bar = left **profile avatar** (gradient circle) + "Chat" title, right **history clock** icon. **Verse-of-day banner** (rounded 22, desaturated **aurora gradient**, eyebrow "VERSE OF THE DAY" pill, serif verse, ref). **"Explore Topics"** SectionHeader + **2-col topic-card grid** (tall rounded 18 cards, color-coded by topic family, title serif + subtitle sans + ↗ chip bottom-left). **★ Floating glass Ask pill** pinned above tab bar (§3.1). → our Ask tab.
- **16 ★ Ask conversation screen:** ghost back (top-left) + **Aa text-size + gear** cluster (top-right). **AI-seeded curated serif opener** (naked, no bubble). **Per-answer action toolbar** (👍 👎 Copy Share ↻regenerate — small translucent pills). Large empty void (faint top vignette glow). Docked input pill + mic. Keyboard up. → our chat conversation; we already stream — restyle.
- **17 ★ VOICE listening:** center **radial gold sunburst** visualizer (amplitude-reactive, §4.10), "I'm listening..." serif, top-right **waveform** icon (→ voice picker), bottom = grey **X** (cancel) + opaque **white mic** (active), spatially separated.
- **18 Voice picker sheet:** bottom-sheet listing TTS voice names + "Try" (inline preview); selected = bold/bright (weight = selection), grab handle, hairline rows.
- **19 / 24 PROFILE drawer (left slide-over):** header = gradient avatar + name + @handle; **2-up streak StatCards** (Current/Longest, flame); **color-coded grouped menu** (Your Verses / Bible Trivia[=Quiz] / Holy Calendar / Add Blessing Partner / Discover Widgets — each a colored rounded-square badge + label + chevron); **emotional photo upsell card** ("You're changing lives...", "Discover How" pill); footer group (Subscription/About/Account). It's a NAV HUB. (§2.2)
- **20 Trivia/Quiz modes sheet:** slide-up over dimmed parent; centered serif title + subtitle; 3 mode rows (Quick Match / Friendly Match / Solo Practice) each icon-badge + title + subtitle + chevron. → our Quiz (Daily + Practice).
- **21 Topic → suggested-questions sheet:** "You might want to ask about..." + ~7 tappable serif question rows (hairline-separated) + pinned high-contrast **"Ask your own question"** pill CTA. Cold-start helper.
- **22 / 23 CHAT HISTORY:** back + "History" + "+" (new). **Horizontal sliding filter chips** (All chats / Favorites / Daily Plan / Discover / "Start a new chat" at the end). Conversation rows = serif title + 2-line serif snippet + meta (💬 replies · relative time) + trailing favorite ☆. Chip selection cross-fades the list.

### 5.C CALENDAR · STREAK · WIDGETS · SETTINGS · QUR'AN READER (frames 25-36)
- **25 Holy Calendar LOADING:** calendar grid + **skeleton shimmer** cards (rose-gradient placeholders); date pills load with **staggered per-cell fill** (rings→accent fill+numerals, row by row). (§3.8/§3.10)
- **26 Calendar LOADED:** filled-accent dates (have content) vs grey-ring (ordinary) vs ring-halo (today). Empty below until a date is tapped.
- **27 Date selected:** bright ring on selected; date label + **significance card** (pastel gradient, title+subtitle+chevron) **slide-up+fade** beneath grid.
- **28 Holy-day "Learn" article:** eyebrow caps title + big serif "Learn" + long serif body + fixed **bottom bar (circular control · "Ask" pill · "Share")** — passive reading → conversational follow-up ("Ask about this day").
- **29 Daily Streak (toggle sibling of calendar):** same grid, **flame on completed days**, ring-halo today; bottom **"Add Widgets" card** + 2-up **StatCards** (Current/Longest). Dual-pill top toggle (Daily Streak ↔ Holy Calendar).
- **30 Widget gallery:** Home Screen / Lock Screen dual-pill toggle + vertical widget-type cards (Hourly/Daily Verse, Affirmation, Send-a-blessing). → our Daily Ayah / Du'a / Send-a-du'a widgets.
- **31 Edit Profile form:** centered gradient avatar + pencil badge; **label-over-outlined-input** stack; free-text rows (no chevron) vs picker rows (trailing chevron); leading line-icon per field.
- **32 Account (settings root):** big bold left title "Account" + circular X; ONE grouped SettingsCard (Login/Edit profile/Personalize/Reminders) + version/UID footer. CANONICAL settings template.
- **33 Personalize your conversation:** back-chevron + centered title; grouped card of title/subtitle rows (Answer length/complexity/Tone/Verse-reference toggle) + centered blue "Reset" link. → our AI-answer prefs.
- **34 Manage reminders:** back + title; reminder blocks = **hero serif time numeral (~36)** + weekday chips + "Daily until <date>" + toggle.
- **35 About (settings root):** SAME template as 32 (Rate/Improve/Contact/Share/Terms/Privacy).
- **36 QUR'AN READER (= Bible reader):** top "Bible ▾" (book/translation switch) + search + options; **pericope/section subtitle (italic serif)**; numbered verses (superscript numerals) serif body, ~1.6 lh, warm reading bg; **bottom persistent reference bar** (Book·Chapter + translation code + ‹ › chapter pager) above the tab bar. → our reader: Surah·Ayah + translation/reciter selector; verse-tap → tafsir/Ask.

### 5.D EXPLORE · WATCH · MEDITATION (frames 37-51)
- **37/38/44 EXPLORE ROOT:** header (avatar · "Explore" · search) · "Most Popular" **rotating hero pager** (media card + page-dots, content/brightness varies by time) · **2x2 color-coded category grid** (Meditations teal / Videos purple / Study Plans blue / Reading Plans terracotta — the nav core) · "Continue Where You Left Off" **peek-carousel** · "Recommended for Your Journey" vertical rows. → our Explore: hero (featured Story/Journey) + 2x2 (Stories/Watch/Journeys/Quran-Plan or Quiz) + continue + recommended.
- **39 Continue carousel (heterogeneous):** mixes **plan cards** (✦ badge) and **resumable video cards** (▷ WATCH badge + **progress bar** + timecode). Peek pattern: active ~78% width, neighbors peek ~15-22%, snap paging.
- **40/41 STUDY PLAN detail:** collapsing media hero (transparent nav → solid+centered serif title on scroll, parallax) · "ABOUT THE PLAN" eyebrow · stat pills (📅 7 Days · 👥 enrolled) · serif description · **white full-width "Start Plan ›" CTA** · **Day curriculum list** (DayTimelineCard with dotted spine + headphones/book). → our Journey/Quran-Plan detail.
- **42 Meditation/verse PLAYER (immersive):** full-bleed scenic photo bg · glass "CALM" eyebrow chip · serif title · **italic verse + attribution** · scrubber · circular transport (large center play + flanking circles) · Ken-Burns bg + vignette. → our reciter/ayah player (scenic + ayah + reciter transport).
- **43 Explore search:** rounded capsule field + "Cancel"; content **stays in place under the keyboard** (no jarring blank state) until you type.
- **45/46/47 WATCH (Videos):** "Watch" hub = Featured Series hero (circular play bottom-right) + "Biblical Stories" video rows (thumb + serif title + meta + circular ▷). Series detail = **tap-to-expand hero** (accordion → About + **white "Play All"** + Collections) → scrolled = clip rows + **outlined "See All Clips"** (secondary CTA) + grouped collection ToC rows (title + caps meta + chevron). → our Watch/Stories.
- **48/49/50/51 MEDITATIONS (library):** **horizontal filter-chip row** (All + topics) · "Featured" hero card · **stacked themed horizontal RAILS** ("Morning Series", "Sacred Themes"...) each = label + SEE ALL + **2-up media cards** (✦ duration badge), interleaved with **in-feed wide "featured" heroes** for rhythm (Netflix-shelf system). **51 = "blurred-out top"**: sticky header with **progressive blur + warm-glow** that content **melts into** on scroll; floating circular play FAB bottom-right. → our content libraries (Stories/Watch/Journeys browse).

### 5.E STUDY-PLAN + PERSONAL-PLAN WIZARD (frames 52-64) — the motion showcase
- **52 STUDY home:** category filter chips · "A Growth Plan with God" · **featured hero card** ("7 DAYS" badge, serif title, play FAB) · "Continue Your Studying" carousel · **"Your Personal Study Plan" promo banner** with **"Create Mine"** (→ wizard) · more themed sections.
- **53 STUDY scrolled — SKELETON SHIMMER:** 2-col image-card grid; some cards are shimmer skeletons (real + skeleton coexist, progressive load).
- **54/55 PLAN detail ("When God Moves Mountains"):** cinematic header (gradient-masked into dark) · serif title · meta pills · serif body · sticky **white "Start Plan" CTA** · DayTimelineCard list (dotted spine, headphones+book). Collapsing/parallax header.
- **56 ★ WIZARD INTRO sheet (slide-up bottom→top):** parent page ghosted/dimmed behind (rounded-24 sheet over it). Big void · centered **glowing sun/sparkle emblem** (idle pulse + twinkle) · serif 2-line title "Your Personal Study Plan Awaits" · sans subtitle · big void · **white pill "Build My Study Plan ›"**. (§4.2)
- **57 ★ STEP topic multi-select:** serif question "What would you like to study?" · sub "Select up to 5..." · **centered scripture/āyah quote block** (serif-italic + ref) · **chip cloud** (selectable chips, §3.4, stagger-in) · bottom Continue pill (appears once ≥1 selected). For us: āyah + surah:ayah ref in the quote slot.
- **58 ★ STEP day-count stepper:** question + sub + āyah quote + **−  [big serif 5]  days  +** stepper + "Continue ›". (§3.12)
- **59 ★ STEP free-text intention:** "What's on your heart right now?" + **large textarea** (placeholder example) + **privacy reassurance line** + "Continue ›" (optional/skippable).
- **60/61 ★ ANALYZING loader (relay):** pulsing app emblem + crossfading serif heading + **3 progress rows relay** (active count-up % + bar → check-pop → next brightens). ~66% then steps 1&2 done + step 3 at 1%. (§3.9)
- **62 ★ STEP reminder time:** bell icon + "When should we remind you?" + **frosted glass selector row** (clock + 07:35 + "Every day") + **"Skip for now"** text button above **white "Set Reminder ›"** pill.
- **63 ★ FINISHED PLAN reveal:** new full screen **rises+fades+scales** in (§4.7); cinematic header + serif title + meta pills (incl. **"Your Personal Plan"** badge) + body + **DayTimeline** with **"Continue here"** pill on the current day (pulses once).
- **64 FINISHED PLAN scrolled:** full day timeline with dotted spine + Listen/Read per day; sticky frosted header.
- **Wizard build map:** our **"Build a Qur'an study plan"** wizard (already have quran-plan logic) gets this sheet+steps+relay-loader+reveal treatment. Steps: intro → topics (āyah-themed) → length/pace → intention (optional) → analyzing → reminder → finished plan (DayTimeline = our portions, Listen=recite / Read=read+tafsir).

### 5.X CROSS-CUTTING (the rules that recur app-wide — already tokenized in §1-§4)
Grid: 16px gutter, 2-col cards (12-14 gutter), grouped-inset lists, flat hairline lists, bottom-pinned elements (glass pill / sticky CTA / control bar). Card style: warm near-black base, surfaces step up by lightness + faint top hairline, faint top radial glow on focus screens, soft low shadows. THREE header modes (blur-sticky-melt / collapse-parallax / tap-expand). THREE overlay archetypes (left drawer / bottom sheet / pushed stack). Buttons: white(or gold) full-width primary (only inverted element) / outlined secondary / circular dark icon buttons. Loaders: skeleton-shimmer + relay-analyzing (never a dead spinner). Curated cold-start everywhere (AI-seeded openers, suggested questions). Per-answer toolbar. Dual-modality Listen/Read. Dotted journey spine. Text hierarchy by opacity (100/75-80/55-60/45-50). Serif-content + sans-UI split is sacred.

## 6. SCREEN-BY-SCREEN REDESIGN MAP (our feature ← Bible Chat frame ← build notes)

| Our screen/feature | Existing route | Base on frame(s) | Build notes |
|---|---|---|---|
| **Today** (tab, center) | `(tabs)/today.tsx` | 3,4,5,6,7,8,9,10 | Week-streak chart (streak.ts) · VOTD card (daily-verse) · Reflection (check-in) · My Prayer (prayer-log) — sliding-window, tap-expand + bottom options. **FLAGSHIP #1, build in BOTH palettes.** |
| **Ask** (tab) | `(tabs)/chat.tsx` | 15,16,21,22,23 | VOTD banner + Explore-Topics grid (our hubs) + **glass Ask pill**; conversation = 16 (curated opener, per-answer toolbar, our streaming + image button already exist — restyle); history = 22/23; topics→suggested-questions = 21. |
| **Voice** | `app/voice.tsx` | 17,18 | Radial gold sunburst visualizer; voice-picker sheet. We have voice logic — restyle. |
| **Community** (tab, NEW) | new `(tabs)/community.tsx` | 11,12,13,14 | Ameen wall (our ameen) + live du'as + Islamic events feed; event detail = immersive reader (14). |
| **Qur'an** (tab) | new `(tabs)/quran.tsx` + `surah/[number]` | 36 | Surah index + reader (pericope subtitle, numbered verses, bottom Surah·Ayah·translation·reciter pager); verse-tap → tafsir/Ask. Our reader logic exists — restyle. |
| **Explore** (tab) | new `(tabs)/explore.tsx` | 37-51 | Rotating hero + **2x2 hub** (Stories/Watch/Journeys/Quran-Plan or Quiz) + continue peek-carousel + recommended rows + themed rails + search. Absorbs stories/watch/journeys/hubs browse. |
| **Stories / Watch** | `stories`, `watch`, `watch/[id]` | 45,46,47,42 | Watch hub + series (tap-expand) + immersive player (scenic + transport). |
| **Journeys / Quran-Plan** | `plan/...`, `quran-plan/...` | 40,41,52,54,55,63,64 | Plan detail (collapsing hero + white CTA + DayTimeline Listen/Read). |
| **Personal-plan WIZARD** | `quran-plan/new.tsx` | 56-63 | Slide-up sheet wizard: intro→topics(āyah)→length→intention→**relay loader**→reminder→**finished reveal**. The motion showcase. |
| **Quiz** | `app/quiz.tsx` | 20 | Modes sheet (Daily/Practice) + quiz flow restyle; stat block uses StatCards. |
| **Profile drawer** | `app/profile.tsx` | 19,24,31,32,35 | Left slide-over hub: avatar + streak StatCards + color-coded menu + upsell + footer settings. |
| **Settings (Account/About/Personalize/Reminders)** | profile sub-screens | 32,33,34,35 | Grouped SettingsCard template; reminder rows. |
| **Holy/Islamic Calendar + Streak** | new + streak.ts | 25-29 | Dual-mode calendar (events ↔ streak), skeleton-load, significance cards, widget CTA. |
| **Bookmarks / Your Verses** | `app/bookmarks.tsx` | 19 (menu), reader | Restyle as a "Your Verses" list. |
| **Onboarding / Auth landing** | `components/auth`, `components/onboarding` | (Ui-Design onboarding) | Dark-premium splash + onboarding; emerald/gold. |
| **Splash** | `_layout.tsx` gate | 1,2 | Black → sun bloom → lit verse → Today. |

**Existing logic to PRESERVE (do NOT rewrite — only restyle the presentation):** `lib/` chat.ts, see.ts, photo.ts, stream.ts, quran.ts, translations.ts, recitation-context, streak.ts, prayer-log.ts, daily-verse.ts, bookmarks.ts, hub-affinity.ts, hubs.ts, plan-progress.ts, quran-plan*.ts, quiz.ts, quiz-bank.ts, sync*.ts, profile.ts, auth.ts, supabase.ts, notifications.ts, haptics.ts, watch.ts, plans.ts, markdown.ts, chat-seed.ts, voice-bridge.ts. The redesign is presentation-only on top of these.

### 6.1 FEATURES BIBLE CHAT DOESN'T HAVE (Stories, Qibla, Image-in-Ask, reciter/tafsir)
**Principle:** no reference frame ≠ invent a new language. Compose from §1 tokens + §3 components + §4 motion, map to the nearest archetype (browse / detail / immersive-player / sheet / form), invent ONLY the novel core mechanic, and dress it in the system so it feels native. These are OPPORTUNITIES to OUTSHINE the reference (originality + polish scores points). Preserve all existing logic — presentation only.

- **STORIES (showpiece — aniconic illustrated Qur'an stories + narration; we have Yusuf):** = Bible Chat immersive PLAYER (frame 42) fused with the universal "stories" format.
  - *Browse:* MediaCards w/ aniconic cover art + gold "✦ STORY" badge + serif title; a "Stories" rail in Explore + a 2x2 tile; optionally a featured Story hero on Today/Explore.
  - *Player (cinematic):* full-bleed **panel art** + **Ken-Burns** per panel · **segmented progress bar at top** (one segment/panel, fills with the narration audio) + ghost-circle close + small surah/title chip · **bottom scrim** w/ the **narrated line in serif + ayah ref** · **transport** (play/pause; tap L/R thirds or swipe = prev/next panel; scrubber synced to the panel narration) · **auto-advance** on narration end · cross-fade/subtle-slide between panels, text fades in · top+bottom vignette · gold/emerald progress+controls · end-of-story **"Ask about this" / "Read in the Qur'an"** curated CTA (loops into Ask/reader). Bible Chat has no analog — make it a standout.
- **QIBLA (compass — no analog):** a premium INSTRUMENT on the dark canvas: large elegant compass dial · emerald/gold ring w/ ticks · **gold needle to the Kaaba** + Kaaba glyph at target bearing · current heading + distance to Makkah · smooth **Reanimated rotation** following the magnetometer (damped, no jitter) · soft gold glow + **haptic** when aligned. Only the compass mechanic is novel; the rest is system tokens.
- **IMAGE REFLECTION / FACT-CHECK / VERSE-RECOGNITION (in Ask, already built):** no new screen — restyle within the Ask conversation (glass composer, serif answer, gold accents, verse cards in our card treatment). The camera button + staged-photo preview already exist.
- **OTHER analogs:** reciter/translation pickers = bottom sheets (like voice picker, frame 18); tafsir = expandable panel in the reader (frame 36) or behind-a-tap (like chat tafsir); prayer log = the My Prayer card on Today (frames 3,10); hubs = the Explore-Topics topic cards / sheet (frames 15,21).

## 7. UI-DESIGN FOLDER FINDINGS (the color/aesthetic source — pixel-sampled)

20 frames in `C:\Quran-ChatApp\Ui-Design\` (Home page, color-pallete, typography, onboarding, quran-page, message of the day, features, search, quick tools, notification, language, collection, surah-index, surah-page, surah-play, share-surah, bookmark, Dua's and application, community, overview). It is a **gold-on-near-black** Qur'an app concept. We take the COLOR/AESTHETIC from here, NOT the layout (layout = Bible Chat).
- **REAL sampled tokens:** canvas near-pure black `#020202`-`#050505` (NOT the `#323232` stage the palette swatches sit on); layered surfaces `#141414 → #1E1E1E → #292929`; nav `#0F0E13`; hero accent amber gold `#F0B975` (off the play button + "Last Read" chips), pressed `#D0A16B`, bronze gradient stop `#77531E`; muted `#5F5F5F`; silver secondary `#C0C0C0`. Signature gradient amber→bronze `#F0B975 → #77531E` ~135° (hero card, primary CTA, play FAB).
- **Type:** engraved serif (Playfair/Cinzel-style) used ONLY in marketing frames; **Poppins** (400/500/700) for in-app UI; Uthmani/KFGQPC for Arabic. Section labels often rendered IN amber as the hierarchy device.
- **Premium treatments worth keeping:** gold-on-black, near-black canvas, amber→bronze gradient, **8-point seal medallions**, bilingual gold Arabic, the "Last Read" resume chip.
- **HONEST CRITIQUE (what makes it feel AI-default — FIX these):** (1) serif-title cliché → use serif with intent (Fraunces, not generic). (2) anonymous Poppins → Inter/Geist with a real type scale. (3) doily-style mandala backdrops → drop or make them subtle geometric/noise, not clip-art. (4) flat under-detailed cards → add depth (hairline + subtle gradient + glow). (5) over-bright "plastic honey" gold → deepen to `#E8B866`. (6) MISSING semantic colors → add success/warning/danger (don't overload gold). (7) emerald+gold (our choice) fixes the gold-overload by splitting identity(emerald)/accent(gold).

## 8. TECHNICAL NOTES

- **Theme file:** `mobile/lib/theme.ts` — export `theme` (the §1 tokens), `PALETTE` switch ('emerald'|'amber'), motion tokens, and helpers (e.g. `glow(color)`, `glass()`); replace the hard-coded `#0a7ea4` ACCENT scattered across screens. Provide via a module constant (dark-only; no light theme).
- **Fonts:** add to the `useFonts` in `_layout.tsx` (already loads `AmiriQuran`): Fraunces (serif), Inter (sans) via `@expo-google-fonts/fraunces` + `@expo-google-fonts/inter` (or bundle .ttf in assets/fonts). Keep AmiriQuran for Arabic.
- **Deps to add (all Expo-Go-safe, SDK 54):** `@gorhom/bottom-sheet` (+ peer `react-native-gesture-handler` — check if present), `expo-blur`, `expo-linear-gradient` (check; likely present), optionally `moti`, optionally `lottie-react-native`. `react-native-reanimated` v3 ALREADY installed (imported in `_layout.tsx`). `expo-haptics` already used. `react-native-svg` (check — needed for radial sunburst/glow). Verify each with `npx expo install <pkg>` (SDK-pinned). NOTE earlier guardrail said "no Reanimated worklets" — that is RELAXED for this redesign: Reanimated v3 is required for the "insanely smooth" bar; use it freely (it is installed + Expo-Go compatible).
- **Expo Go constraints:** BlurView, bottom-sheet, reanimated, lottie, svg, linear-gradient all work in Expo Go. Heavy blur + many animations → keep an eye on perf on-device (the user's iPhone is fine). No EAS build needed for any of this.
- **Imagery:** hero/media cards need non-figurative premium images (light rays, desert, sky, geometry, calligraphy, nature, mosque architecture WITHOUT figures). Source royalty-free or generate (aniconic). NEVER depict the Prophet ﷺ or prophets. We already have a pattern (Stories art was aniconic + human-reviewed).
- **Verify every change:** `npx tsc --noEmit` + `npx eslint` (0 errors) in `mobile/`; device-test on Expo Go; commit per-screen (ASCII commit msgs via `git commit -F`, no Co-Authored-By, only when asked).

## 9. BUILD PLAN & STATUS

**Phases:**
- **P0 Foundation (do first):** `lib/theme.ts` (both palettes) · add fonts (Fraunces+Inter) · add deps (bottom-sheet, blur, svg, linear-gradient) · build `components/ui/`: GlassPill, MediaCard, SectionHeader, Chip, SettingsCard, StatCard, BottomSheet, SkeletonShimmer, AnalyzingLoader, PrimaryButton/SecondaryButton, the warm-glow header wrapper, the press-scale Pressable wrapper, the new 5-tab `(tabs)/_layout.tsx` (icons + styling, Today centered) · motion primitives (Stagger, PressableScale, FadeInUp helpers).
- **P1 Flagship — Today in BOTH palettes:** rebuild `(tabs)/today.tsx` per frames 3-10 (week-streak chart, VOTD card, Reflection, My Prayer, sliding-window tap-expand + bottom options). Render once in **emerald-gold** and once in **amber-gold** (PALETTE switch) → user device-tests → **picks the palette** → lock it. Tune feel/motion until it's right. This sets the bar.
- **P2+ Roll out tab by tab** (user reviews each on device): Ask (glass pill + conversation restyle) → Qur'an reader → Explore (2x2 + rails) → Community → then sub-flows (wizard, calendar, settings drawer, quiz, watch/stories player, voice). Restyle, don't rewrite logic.

**STATUS (update this each session):**
- [DONE] Reference teardown of all 83 frames. [DONE] This master spec. [DONE] Locked: serif+sans, 5 tabs, Today first.
- [DONE] **P0 FOUNDATION** (all tsc+eslint clean, UNCOMMITTED): `lib/theme.ts` = both palettes + full tokens (type scale, spacing, radius, shadow, `glow()`, motion, gradients) behind `PALETTE`. Deps added: `expo-linear-gradient` + `@expo-google-fonts/fraunces` + `@expo-google-fonts/inter` (and already present: `expo-blur`, `react-native-reanimated` **v4** + `react-native-worklets`, `react-native-svg`, `react-native-gesture-handler`, `expo-haptics`, `hijri-converter`, `adhan`, `expo-location`). Fonts loaded in `app/_layout.tsx` (Fraunces 400/400i/500/600 + Inter 400/500/600/700 + AmiriQuran). `components/ui/`: `pressable-scale.tsx` (Reanimated press-scale+haptic), `screen.tsx` (canvas + warm top-glow LinearGradient + SafeArea), `primitives.tsx` (Txt[variant], Card, IconButton, Divider). New **5-tab shell** `app/(tabs)/_layout.tsx`: Ask(chat) · Community(new) · Today(center, sun) · Qur'an(index) · Explore(new); gold active; `stories`+`prayer` set `href:null` (hidden). Placeholders `(tabs)/community.tsx` + `(tabs)/explore.tsx`. `app/_layout.tsx` now FORCES a dark nav theme + `StatusBar style="light"` (dark-only regardless of device).
- [DONE] **P1 FLAGSHIP TODAY** (`app/(tabs)/today.tsx` rebuilt, tsc+eslint clean, UNCOMMITTED): top bar (ProfileCircle + "Assalamu alaykum" + Hijri/Greg date + gold streak-flame chip) · **week-streak strip** (added `getWeek`/`useWeekStreak`/`WeekDay` to `lib/streak.ts`, today gold-ringed) · **illuminated Verse-of-Day hero** (gold-gradient hairline border via LinearGradient(1px pad)+inner surface2, soft `glow(accent)`, big serif-italic translation + Amiri Arabic w/ room, recite[VerseSpeaker]/save[bookmarks]/share/gold-ask actions) · Reflection prompt card (logs 'checkin') · **Prayer tracker** (usePrayerLog 5-fard toggles, real) · Continue-reading card → reader. Real data preserved (resolveToday/getVerse/verseText/useStreak). Today is now FOCUSED — the old plans/hubs/watch/ameen entries were REMOVED from Today (they go to Explore/Community). Old `components/home/*` (StreakHero/MoodCheckIn/QuranPlanCard/etc.) now unused by today.tsx but kept on disk.
- ⏳ **PALETTE DECISION PENDING (the gate before continuing):** user found the first emerald (`#1FA37A`) too light/bright → I deepened it to a **deep jewel emerald** (primary `#0E9F6B`, canvas `#04120C`, rich deep-emerald surfaces, bright glow `#2FD79E`) with 5 alternate primary hexes in the `theme.ts` emerald comment (deeper #0B8559 · current #0E9F6B · vivid #12B07C · jade/teal #0BA47F · forest #0A7A52). **`PALETTE` currently = `'amber'`** (user set it; do NOT revert unless asked — they flip to `'emerald'` to view the new green). NEXT: user compares deep-emerald vs amber-gold on device, picks → **LOCK the palette** (and we may also deepen the amber if chosen, since it read "light"), THEN add the Today MOTION (sliding-window tap-expand, stagger-in, sheet language — Reanimated v4, "no-worklets" constraint is RELAXED), THEN roll out P2 tabs.
- [NOT BUILT YET] remaining `components/ui/`: GlassPill, MediaCard, SectionHeader, Chip, SettingsCard, StatCard, BottomSheet (@gorhom/bottom-sheet not yet installed), SkeletonShimmer, AnalyzingLoader, Primary/SecondaryButton. Ask & Qur'an tabs still OLD UI; Community & Explore are placeholders. No screen motion yet (only press-scale).
- **GIT:** all redesign work is UNCOMMITTED on top of pushed origin/main `8d9f156`. Commit per-phase only when the user asks (ASCII msgs via `git commit -F`, no Co-Authored-By).

**Remember the meta-goal:** this is a job application; the reviewer judges on UI/UX/animation. Bias toward fewer, more-polished screens over many rough ones. Obsess over motion + feel. Device-review relentlessly. When unsure, VIEW the actual Bible-chat frame.



