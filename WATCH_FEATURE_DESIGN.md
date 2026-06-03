# Watch Feature — React Native Design Spec

*Two tracks (Seerah · Islamic history) of chronological video chapters, in-app YouTube playback, watched-progress, entered from a Home "Watch" card. Built for the existing "Daily Qur'an" app — Expo SDK 54, Expo Go iOS, $0, calm/reverent aesthetic.*

This spec leads with the **recommended design**, then **alternatives with tradeoffs**, then the **inspiration notes** that justify it. Everything is sized for direct StyleSheet implementation and reuses the app's existing tokens, `FadeIn`, and `LayoutAnimation` motion language.

---

## 0. Grounding in the existing app (so this drops in cleanly)

These are the real conventions this spec inherits (pulled from the codebase, not invented):

| Token / pattern | Value in repo | Where it's used today |
|---|---|---|
| Accent teal | `#0a7ea4` | tint, CTAs, "go to" pills |
| Teal translucent fill | `rgba(10,126,164,0.08–0.15)` | Listen-all card, Find-peace, badges |
| Neutral translucent fill | `rgba(127,127,127,0.08–0.16)` | cards, rows, badges, pressed states |
| Hairline border | `StyleSheet.hairlineWidth` + `rgba(127,127,127,0.25)` | verse cards, list rows |
| Gold accent | `#c8a24a` / `#f0d489` / `#f4e2b8` | bookmarks, scripture cards, story player |
| Flame/streak amber | `#f59e0b`, fill `rgba(245,158,11,0.08)` | StreakHero |
| Card radius | `16` (rows/cards), `20–22` (feature cards), `12` (buttons/inputs), `999` (pills) | throughout |
| Screen padding | `padding: 16`, `gap: 16` on scroll content | every tab |
| Section header type | `fontSize 12`, `weight 700`, `opacity 0.5`, `letterSpacing 0.5`, UPPERCASE | Qur'an search "Surahs/Verses", "CONTINUE READING" |
| `ThemedText` types | `default 16/24`, `defaultSemiBold 16/24/600`, `subtitle 20/700`, `title 32/700` | all text |
| Motion: appear | `<FadeIn delay duration={550} offset={10}>` fade+rise+scale 0.97→1, `Easing.out(cubic)`, **once on mount** | chat verse card |
| Motion: expand/collapse | `LayoutAnimation` | collapsible |
| Player precedent | full-bleed near-black `#0b0d12`, top bar (back · crumb), bottom bar (control + 3px progress track `rgba(255,255,255,0.15)` / fill `#c8a24a`) | `stories/[id].tsx` |
| Haptics | `haptic.light()` on nav taps | hubs, search |
| Nav | `expo-router`; list screens are stack routes pushed from Home (`/hubs`, `/qibla`); detail routes are `[id].tsx` | hubs, stories, qibla |

**New dependency (one):** `react-native-youtube-iframe` (a `react-native-webview` wrapper). `react-native-webview` ships in Expo Go's SDK, so this works **without a custom dev build** — it satisfies the $0 / Expo-Go-only constraint. See §9.

**Aesthetic stance for Watch:** the **list/browse surfaces stay in the app's light/dark theme** (like Today/Qur'an/Hubs — calm, airy). The **player screen goes immersive near-black** (`#0b0d12`), exactly like the Stories player, because video wants a dark surround. This duality already exists in the app, so Watch will feel native to it.

---

# PART A — RECOMMENDED DESIGN

## 1. Information architecture & navigation

```
Home (Today tab)
  └─ "Watch" card  ──push──▶  /watch                (Watch home: track switcher + chapter timeline)
                                  └─ tap chapter ──push──▶  /watch/[chapterId]   (Player screen)
                                         └─ Next/Prev ─── replace ──▶ /watch/[nextId]
```

- `/watch` is a **stack route pushed from Home** (mirrors `/hubs`), **not** a 6th bottom tab. Rationale: the tab bar already has five items (Today · Qur'an · Ask · Stories · Prayer); a sixth crowds it, and Watch is a "lean-in session" destination, not a daily-glance surface. Entering from a Home card matches how Hubs/Qibla are reached.
- Route files: `mobile/app/watch.tsx` (home) and `mobile/app/watch/[id].tsx` (player). Data in `mobile/lib/watch.ts`.

### Data shape (drives every component below)

```ts
// mobile/lib/watch.ts
export type Track = 'seerah' | 'history';

export type WatchVideo = {
  youtubeId: string;        // e.g. "abcd1234"
  title?: string;           // optional sub-title when a chapter has >1 video
  durationSec: number;      // for the duration badge ("12 min")
};

export type Chapter = {
  id: string;               // stable, e.g. "seerah-01"
  track: Track;
  order: number;            // 1-based; drives the node number & timeline order
  title: string;            // "The Year of the Elephant"
  era: string;              // short label: "Before Revelation · 570 CE"
  blurb: string;            // 1–2 lines, shown on the player & (truncated) on the card
  videos: WatchVideo[];     // usually 1; supports a small playlist
};

export const TRACKS: { key: Track; label: string; subtitle: string; accent: string }[] = [
  { key: 'seerah',  label: 'Seerah',  subtitle: 'Life of the Prophet ﷺ', accent: '#0a7ea4' },
  { key: 'history', label: 'History', subtitle: 'Eras of Islam',         accent: '#c8a24a' },
];
```

**Progress** is local-first (no backend needed), stored via the same AsyncStorage pattern the app already uses (`getLastRead`, streak ledger). Key suggestion: `watch:progress` →
```ts
type Progress = Record<string /*chapterId*/, { watched: boolean; pct: number; updatedAt: number }>;
```
`pct` (0–1, max watched fraction) powers the partial ring; `watched` (set true at ≥ ~0.9 or on manual "Mark watched") powers the ✓. Expose a tiny hook `useWatchProgress()` returning `{ map, perTrack(track) → {done,total}, markWatched(id), setPct(id,pct), continueChapter() }`, mirroring `useStreak()`/`useBookmarks()`. Opening a chapter should `recordActivity('watch')` so it feeds the existing streak.

---

## 2. Watch home screen — layout (RECOMMENDED: segmented control + vertical timeline)

```
┌─────────────────────────────────────────────┐
│  ‹            (native stack header: "Watch")  │   ← Stack.Screen title="Watch"
├─────────────────────────────────────────────┤
│                                               │  SafeAreaView edges={['bottom']}, ScrollView
│  Watch                                        │  h1  (28–30, weight 700)
│  Follow the story in order — the Seerah and   │  sub (14, opacity 0.6, lineHeight 20)
│  the eras that followed.                      │
│                                               │
│  ┌─────────────────┬─────────────────┐        │  ← SEGMENTED CONTROL (track switcher)
│  │ ● Seerah        │   History       │        │     selected pill slides between halves
│  └─────────────────┴─────────────────┘        │
│   Life of the Prophet ﷺ                       │  active track subtitle (13, opacity 0.6)
│                                               │
│  ┌───────────────────────────────────────┐    │  ← TRACK PROGRESS SUMMARY card
│  │  ◔  3 of 10 watched      ▓▓▓░░░░░░░    │    │     ring + label + slim bar
│  └───────────────────────────────────────┘    │
│                                               │
│   │①─ [thumb] The Year of the Elephant     ✓ │  ← TIMELINE of chapter cards
│   │          Before Revelation · 570 CE      │     numbered nodes + connector spine
│   │          12 min                          │     down the left edge
│   │                                          │
│   │②─ [thumb] The First Revelation       ◔  │
│   │          Cave of Hira · 610 CE   ▓▓▓░ 60%│
│   │                                          │
│   │③─ [thumb] The Early Believers            │
│   │          Makkah · 610–613 CE             │
│   ⋮                                          │
└─────────────────────────────────────────────┘
```

**Vertical rhythm (top→bottom):** header block → `12` → segmented control → `8` → track subtitle → `16` → progress summary card → `20` → timeline list. Outer `padding: 16`.

**Switching tracks is instant + animated:** changing the segment calls `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` right before `setTrack(...)`, so the timeline list cross-dissolves/re-lays out smoothly. Each chapter card is wrapped in `<FadeIn delay={i*40}>` keyed by `track` so the new list **staggers in** (fade+rise) — the same delight as the chat verse card. (Keying on `track` remounts FadeIn so it re-runs per switch.)

---

## 3. Track switcher — **segmented control** (the recommendation, with rationale)

**Decision: a 2-segment iOS-style segmented control** (a sliding pill inside a rounded track), full-width under the header.

**Why segmented control over the alternatives:**
- **vs. bottom tabs / top tab navigator:** overkill for two peers and visually heavy; tabs imply "different sections of the app." Here it's *the same kind of content, filtered* — the canonical segmented-control use case (Apple HIG: "choose between alternate views/sets of the same kind of content").
- **vs. horizontal chips:** chips read as *multi-select filters* and look unbalanced with only two options; users expect more chips to exist off-screen. With exactly two mutually-exclusive tracks, a segmented control communicates "pick one of these two" perfectly and is the most "tactile" (the sliding thumb is a satisfying micro-interaction the user values).
- **vs. stacked sections (both tracks on one scroll):** loses the clean "one timeline at a time" focus and makes "3 of 10" progress ambiguous; double the scroll length. (Kept as Option C in Part B for completeness.)

**Component spec — `TrackSwitcher`:**

```
Track container:  height 38, borderRadius 12, padding 3,
                  backgroundColor rgba(127,127,127,0.12)   // matches search input fill
                  flexDirection row
Segment (×2):     flex 1, height 32, borderRadius 9, center/center
Selected thumb:   an Animated.View, same size as a segment, absolutely positioned,
                  backgroundColor (light) #ffffff  /  (dark) rgba(255,255,255,0.14)
                  borderRadius 9,
                  shadow (light only): shadowColor #000, opacity 0.12, radius 4, offset {0,1}, elevation 2
Label:            fontSize 14, weight 600
                  selected → color #11181C (light) / #ECEDEE (dark)   (theme text)
                  unselected → opacity 0.55
Selected dot:     optional 6px teal dot before the active label (●), or omit for cleaner look
```

**Thumb animation:** one `Animated.Value` (0|1) driven by `Animated.spring(v, { toValue: idx, useNativeDriver: true, friction: 9, tension: 80 })`; `translateX` interpolates `[0, segmentWidth]`. `segmentWidth = (containerWidth - 6) / 2`, measured via `onLayout`. Fire `haptic.light()` on change (the app already uses it on taps). This is the one bit of custom motion; everything else is FadeIn/LayoutAnimation.

> Note: don't use `@react-native-segmented-control/segmented-control` — it's a native module and **won't load in Expo Go**. Hand-roll the ~50-line component above (Pressable ×2 + one Animated thumb). This is also more on-brand and themeable.

---

## 4. Chapter card anatomy (the core component)

Two layout options were considered; **Option 1 (timeline row with leading node + thumbnail) is recommended.** Exact anatomy:

```
        connector (above)
          │
   ┌──────┼─────────────────────────────────────────────┐
   │     ┌──┐                                              │
   │  ───│①│   ┌───────────┐  The Year of the Elephant  ✓ │   ← row: node · thumb · text · status
   │     └──┘   │  thumb    │  Before Revelation · 570 CE   │
   │      │     │ 16:9  ▶   │  12 min                       │
   │      │     └───────────┘                               │
   └──────┼─────────────────────────────────────────────┘
          │
        connector (below)
```

### Elements, left → right

1. **Timeline node** (the number): `28×28` circle, centered on the card's vertical midline, sitting on the connector spine at `left: 14` (within the row's left gutter).
   - **Unwatched:** border `1.5` solid `rgba(127,127,127,0.45)`, transparent fill, number in theme text `13/700`.
   - **In-progress:** the circle becomes a **progress ring** (teal arc for `pct`) around the number — see §6.
   - **Watched:** filled accent circle (track accent: teal for Seerah, gold for History), white `✓` (16px) replacing the number, subtle.
2. **Connector spine:** a `2px` vertical line at `left: 27` (node center), color `rgba(127,127,127,0.25)` (the app's hairline tone). Drawn **between** nodes only — top connector hidden on the first card, bottom connector hidden on the last. The segment **above a watched node** is tinted to the track accent at `0.4` alpha (a quietly "filled-in path," Duolingo-style) ; segments below stay neutral.
3. **Thumbnail:** `112×63` (16:9), `borderRadius 10`, `overflow hidden`. Source: `https://i.ytimg.com/vi/<id>/hqdefault.jpg` via `expo-image` (already a dependency) with `contentFit="cover"` and `transition={250}`. A small translucent **play chip** bottom-left: `22×22` circle `rgba(0,0,0,0.5)` + white `▶` 11px. If a chapter has >1 video, a tiny count pill top-right (`rgba(0,0,0,0.55)`, "1/3").
4. **Text column** (`flex: 1`, `gap: 3`, left margin `12` from thumb):
   - **Title** — `ThemedText` `fontSize 15.5, weight 700, lineHeight 20`, `numberOfLines={2}`.
   - **Era label** — `fontSize 12, weight 600`, color = **track accent** (teal/gold), `numberOfLines={1}`. This is the "era" requested; coloring it ties the row to its track.
   - **Meta line** — `fontSize 12, opacity 0.55`: duration ("12 min"); when in-progress, append a slim inline bar + "60%" (see §6) instead of plain duration, or keep duration and put the bar under the title — recommended: **duration on the left, % on the right of the same meta line.**
5. **Status (far right, `28` wide, centered):**
   - watched → the ✓ is already in the node; on the right show nothing, or a faint `rgba(...)` chevron `›` to afford "rewatch."
   - default → faint chevron `›` (`rgba(127,127,127,0.4)`, 18px), matching the Hubs row affordance.

### Card container & states

```
Card:        flexDirection row, alignItems center,
             paddingVertical 12, paddingLeft 0 (node lives in a 44px left gutter), paddingRight 12,
             // NO card background by default — rows sit on the timeline like Qur'an surah rows,
             // separated by the connector, NOT boxed. Keeps it airy + lets the spine read.
Pressed:     a rounded rgba(127,127,127,0.10) wash behind the row (borderRadius 14) via
             style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
Watched row: title/era at opacity 0.6 (gently recede, like a read email) — but the ✓ node stays full color.
Hit target:  whole row, min height 72 (≥44pt) ; haptic.light() on press.
```

**Light vs dark:** identical structure. Node border/connector use the `rgba(127,127,127,…)` neutrals (theme-agnostic by design). Thumbnail unaffected. Accent colors (teal/gold) are already legible on both themes in this app.

**Typography summary (one place):** title `15.5/700`, era `12/600` accent, meta `12/0.55`, node number `13/700`. All within the app's existing scale.

---

## 5. The vertical timeline — **yes, use it**, and exactly how

The user framed this feature as a "timeline," and chronological ordering is the whole point (Seerah events in sequence; eras in sequence). A vertical timeline with numbered nodes + connectors is the right metaphor and the strongest differentiator from a plain video list. Concrete construction:

- **Left gutter = 44px.** Inside it: the `2px` connector centered at `x≈27`, and each `28px` node centered on its row's vertical midline.
- **Connectors are drawn per-row, not as one absolute line**, so they survive dynamic row heights:
  - Each row renders two thin absolutely-positioned `View`s in the gutter: **top half** (`top: 0 … 50%`) and **bottom half** (`50% … bottom`).
  - First row: hide the top half. Last row: hide the bottom half. (Gives clean open ends.)
  - This avoids the classic "one tall line that mismatches row heights" bug and needs no measurement.
- **"Filled path" progress (Duolingo cue):** for each row, if **this** node is watched, tint its **top** connector half to `accent @ 0.4`; the spine visually "completes" up to the furthest watched chapter. Cheap, and instantly readable as "how far you've come."
- **Node = the progress indicator** (see §6) so the timeline itself shows per-chapter state — no separate badges needed.
- **Era group headers (optional, recommended for History):** History spans wide eras (Rashidun, Umayyad, Abbasid…). Insert a lightweight sticky-ish header **between** chapters when `era group` changes: a small UPPERCASE label (`12/700, opacity 0.5, letterSpacing 0.5`) with a short `rgba(127,127,127,0.25)` rule, aligned to the text column (left `56`), the spine passing behind it. Seerah is one continuous life, so it can skip group headers or use phase labels (Makkah / Madinah).

**Why not a fancier path (winding Duolingo S-curve)?** A snaking path is delightful in Duolingo but (a) is heavy to build correctly in RN, (b) reads as "game levels," and (c) fights the reverent, document-like calm of this app. A **straight vertical spine** is the tasteful, buildable choice here. (Documented as an alternative in Part B.)

---

## 6. Progress UI

Three coordinated indicators, all from the same `useWatchProgress()` data:

**(a) Per-chapter node states** (in the timeline):
- **Unwatched:** hollow ring, number visible.
- **In-progress (0 < pct < ~0.9):** a **progress ring** around the node. Implementation without SVG/native: a `28×28` ring built from **two half-circle overlays** (border-arc technique) is fiddly — instead use the **simplest robust approach**: keep the hollow node + number, and show the partial state via the **meta-line mini-bar** (below) plus a small accent **dot** on the node's top-right (a 7px `accent` dot, like a notification dot). If a true ring is wanted, add `react-native-svg` (ships in Expo Go) and draw one `<Circle>` with `strokeDasharray` — clean and 10 lines. **Recommend: SVG ring** since the app values polish and `react-native-svg` is Expo-Go-safe.
- **Watched:** filled `accent` disc + white ✓.

**(b) Per-chapter mini-bar** (in the card meta line, only when in-progress): a `3px` track `rgba(127,127,127,0.25)`, fill `accent`, width ~`64`, with `"60%"` label `11/600 accent` to its right. Mirrors the player's bottom progress bar so the language is consistent app-wide.

**(c) Per-track summary card** (top of list, above the timeline):
```
┌──────────────────────────────────────────────┐
│  ◔   3 of 10 watched         ▓▓▓░░░░░░░░░░░    │
└──────────────────────────────────────────────┘
Card:   flexDirection row, alignItems center, gap 14,
        padding 14, borderRadius 16,
        backgroundColor accent @ 0.08, border hairline accent @ 0.22
        (exactly the StreakHero / Find-peace treatment, but in the track's accent)
Ring:   a 36px SVG donut showing done/total (accent arc on rgba(127,127,127,0.18) track),
        OR a count badge if skipping SVG.
Label:  "3 of 10 watched"  — fontSize 15, weight 700 ; if 0 → "Start the Seerah" / "Begin the timeline"
Bar:    flex 1, height 6, borderRadius 3, track rgba(127,127,127,0.2), fill accent, animated width.
```
The summary's accent **follows the active track** (teal for Seerah, gold for History), reinforcing the switch.

> All progress fills/widths animate via `LayoutAnimation.easeInEaseOut` when they change (e.g. returning from the player with a new %). No extra libraries.

---

## 7. Player screen — `/watch/[id]`

Immersive near-black surround (`#0b0d12`), matching the Stories player so the two feel like siblings. Video on top, content below, persistent prev/next.

```
┌─────────────────────────────────────────────┐
│ ‹            Seerah · 2 / 10                  │  ← top bar (back · crumb), over the video, safe-area top
│ ┌─────────────────────────────────────────┐  │
│ │                                          │  │
│ │            YouTube  (16:9)               │  │  ← react-native-youtube-iframe, width = screen
│ │              ▶  player                    │  │     height = round(width * 9/16)
│ │                                          │  │
│ └─────────────────────────────────────────┘  │
│  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  (2px scrub-progress)│  ← thin watched-progress under the video
│                                               │
│  CHAPTER 2                                    │  kicker (12/800/letterSpacing1.5, gold #c8a24a)
│  The First Revelation                         │  title (24/800, #fff, lineHeight 30)
│  Cave of Hira · 610 CE                         │  era (13/600, accent)
│                                               │
│  In the cave of Hira, the first words of the  │  blurb (16/25, rgba(255,255,255,0.86))
│  Qur'an were revealed…                         │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │   ✓  Mark as watched                     │ │  ← primary action (toggles)
│  └─────────────────────────────────────────┘ │
│                                               │
│  (if chapter has >1 video: a small "Part 1·2·3"│  optional segmented list of the chapter's videos
│   row that swaps the player source)            │
│                                               │
│  ─────────────────────────────────────────── │
│  ‹ Previous            Up next ›              │  ← prev/next nav (disabled at ends)
│    The Year of…        The Early Believers     │
└─────────────────────────────────────────────┘
```

**Layout specifics:**
- **Top bar:** reuse the Stories player pattern verbatim — `iconBtn` (40×40, `rgba(0,0,0,0.35)` over video, white `‹` 28px) + a centered `crumb` pill (`rgba(0,0,0,0.35)`, `"Seerah · 2 / 10"`, `13/700`). `Stack.Screen options={{ headerShown:false, animation:'fade' }}` and `animation:'fade'` so entering the player **cross-fades** (already the Stories convention) rather than a jarring push.
- **Video:** `YoutubePlayer height={Math.round(width*9/16)} width={width} videoId={id} play={playing}` . Let YouTube's own chrome handle play/pause/scrub/fullscreen (don't rebuild controls — less code, fewer bugs, and matches user expectation). `webViewProps={{ allowsInlineMediaPlayback:true }}`.
- **Watched-progress bar (under video, 2px):** poll `playerRef.current.getCurrentTime()` on a `setInterval(…, 1000)` while mounted; `pct = currentTime / durationSec`; persist max-pct to storage (throttled). Fill `#c8a24a` on `rgba(255,255,255,0.15)` — identical to the Stories progress track.
- **Auto-mark watched:** on `onChangeState === 'ended'` **or** when `pct ≥ 0.9`, call `markWatched(id)` and flip the button to its done state with a `haptic.success()`; subtly **auto-advance is NOT default here** (unlike Stories) — learning content benefits from a deliberate "Up next" tap. Offer it as a quiet toast/inline "Up next →" that's tappable.
- **Mark-watched button:** full-width, `paddingVertical 14, borderRadius 12`. Unwatched: `#0a7ea4` bg, white "Mark as watched". Watched: `rgba(255,255,255,0.08)` bg, hairline `rgba(255,255,255,0.2)`, gold ✓ + "Watched" — a clear, reversible state (tap to unmark).
- **Content appears** with `<FadeIn delay={120}>` so it settles in after the player mounts (same trick as chat). The blurb/era/title block, then the button, then the nav — a gentle cascade (`delay` 120 / 200 / 280).
- **Prev/Next:** a row split 50/50, hairline-topped (`rgba(255,255,255,0.12)`). Each side: a tiny UPPERCASE label ("PREVIOUS"/"UP NEXT", `11/700, rgba(255,255,255,0.5)`) + the neighbor's title (`14/600, #fff, numberOfLines 1`). Tapping calls `router.replace('/watch/'+neighborId)` (replace, not push, so the back button always returns to the timeline — no deep stack). Disabled (opacity 0.3, no press) at the first/last chapter. `haptic.light()` on tap.
- **Cross-track boundary:** prev/next stay **within the active track**; at a track's end, "Up next" is disabled (don't silently jump tracks).

---

## 8. Home "Watch" card (entry point on the Today tab)

Placed on the Today screen near the other feature cards (after `MoodCheckIn` / near `Find peace`). **Two designs; recommend the "Continue watching" smart card** that falls back to a track-preview when nothing's in progress.

**State A — has a continue-watching chapter** (most engaging; mirrors MasterClass/Netflix "Continue watching"):
```
┌─────────────────────────────────────────────┐
│ ┌───────────┐  CONTINUE WATCHING             │  kicker 11/700 teal, letterSpacing 0.5
│ │  thumb    │  The First Revelation          │  title 16/700, numberOfLines 1
│ │ 16:9  ▶   │  Seerah · 2 of 10              │  meta 13/0.6
│ │ ▓▓▓░ 60% │  ▓▓▓▓▓▓░░░░░░░░  (resume bar)  │  3px teal resume bar
│ └───────────┘                              › │
└─────────────────────────────────────────────┘
Card:  flexDirection row, gap 14, padding 14, borderRadius 16,
       backgroundColor rgba(10,126,164,0.08), border hairline rgba(10,126,164,0.2)
       (the Find-peace treatment)
Thumb: 96×54 (16:9), radius 10, play chip; thin resume bar across its bottom edge.
Tap → router.push('/watch/'+continueId)  (jumps straight back into the player)
```

**State B — nothing in progress (first run / fallback)** — a track-preview that sells the feature:
```
┌─────────────────────────────────────────────┐
│  🎬 (or play-circle icon, teal)               │
│  Watch                                        │  title 16/700
│  The Seerah & the eras of Islam, in order     │  blurb 13/0.6
│                                            ›  │
└─────────────────────────────────────────────┘
Same row/icon pattern as the Find-peace and Listen-all cards.
Tap → router.push('/watch')  (opens the timeline)
```

Pick the state at render from `useWatchProgress().continueChapter()`. Icon: `Ionicons "play-circle"` or `"film-outline"` in `#0a7ea4`, in the app's `44×44` rounded teal `rgba(10,126,164,0.12)` icon well (matches Listen-all). This single card is the only Home footprint — calm, consistent, one tap in.

---

## 9. Feasibility — in-app YouTube in Expo Go ($0)

- **Library:** `react-native-youtube-iframe` (wrapper over `react-native-webview`, which is in the Expo Go SDK). Docs explicitly list "✅ Expo support"; it renders the YouTube **IFrame Player API** in a WebView, so **no custom native build / EAS is required** — fits the Expo-Go-only constraint. (Do **not** use the deprecated native `react-native-youtube`, nor the native `@react-native-segmented-control` — neither loads in Expo Go.)
- **Install:** `npx expo install react-native-youtube-iframe react-native-webview` (let Expo pin SDK-54-compatible versions; check `https://docs.expo.dev/versions/v54.0.0/` per repo AGENTS.md before coding).
- **Control surface used:**
  - `videoId`, `play`, `height`, `width` props.
  - `onChangeState(state)` → `'playing' | 'paused' | 'ended' | 'buffering'`; use `'ended'` to auto-mark watched.
  - `ref.current.getCurrentTime()` / `getDuration()` → poll for the progress bar & resume %.
  - `onReady` → hide a loading shimmer.
- **Caveat to document (honesty per the project's README discipline):** WebView YouTube playback **can't background-audio** in Expo Go (same UIBackgroundMode limitation already noted for recitation), and embeds depend on the video owner allowing embedding. Pick chapter videos that permit embedding; fall back to an "Open in YouTube" link (`expo-linking`) if `onError` fires.

---

## 10. Empty / loading / error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| **Watch home** | Content is bundled (no fetch) → no spinner; if a track has 0 chapters yet, show empty. | Centered: faint `film-outline` 40px + "Chapters are on the way." `opacity 0.5` (the app's `empty` style). | n/a (local data). |
| **Thumbnail** | `expo-image` `transition={250}` fades the image in; backing color `rgba(127,127,127,0.12)` shows meanwhile. | If thumb 404s, keep the colored block + a centered play chip. | Same fallback block. |
| **Player video** | A `rgba(255,255,255,0.06)` block at 16:9 with a small centered `ActivityIndicator` until `onReady`. | n/a | On `onError`: replace the player area with "This video can't play here." + a teal "Open in YouTube ↗" (`Linking.openURL`). Keep title/blurb/nav so the screen isn't dead. |
| **Progress** | Reads sync from storage on focus (like `getLastRead` in `useFocusEffect`); no spinner. | First run → summary shows "Start the Seerah". | Storage failures are swallowed (best-effort), default to 0%. |

All three player/empty states reuse existing tones (`rgba(255,255,255,0.06)`, `opacity 0.5` muted text, teal links) so nothing looks foreign.

---

## 11. Motion summary (consistent with the app)

| Moment | Technique | Detail |
|---|---|---|
| Timeline cards appear / re-appear on track switch | `FadeIn` keyed by `track` | `<FadeIn delay={i*40}>` stagger; fade+rise+scale, `Easing.out(cubic)`, runs once per switch. |
| Track switch re-layout | `LayoutAnimation.easeInEaseOut` | called immediately before `setTrack`. |
| Segmented thumb slide | `Animated.spring` (the only bespoke anim) | `friction 9, tension 80`, `translateX`, `useNativeDriver`. |
| Progress bars/ring fill changes | `LayoutAnimation.easeInEaseOut` | on focus when returning from player. |
| Enter player | `Stack.Screen animation:'fade'` | cross-fade into the dark player (Stories convention). |
| Player content settles in | `FadeIn delay 120/200/280` | title → button → nav cascade. |
| Every nav tap / mark-watched | `haptic.light()` / `haptic.success()` | matches Hubs/search/Stories. |

No new animation library. Everything is `Animated` + `LayoutAnimation` + `FadeIn`, exactly as the rest of the app.

---

## 12. Component & file breakdown (implementation checklist)

```
mobile/lib/watch.ts
  - types (Track, Chapter, WatchVideo), TRACKS, getChapters(track), getChapter(id),
    neighbors(id) → {prev, next}, ytThumb(id), fmtDuration(sec)
mobile/lib/watch-progress.ts
  - useWatchProgress(): { map, perTrack(track), continueChapter(), markWatched(id),
    toggleWatched(id), setPct(id, pct) }  (AsyncStorage, mirrors lib/streak.ts)

mobile/app/watch.tsx              (Watch home)
  - <TrackSwitcher value onChange/>           (≈50 lines, Pressable×2 + Animated thumb)
  - <TrackProgressSummary track/>             (ring + label + bar)
  - <ChapterTimeline track/>  → maps chapters → <ChapterRow/>  inside <FadeIn>
mobile/components/watch/chapter-row.tsx
  - node (ring/✓) + connector halves + thumb + text + status; pressed wash
mobile/components/watch/progress-ring.tsx     (react-native-svg donut; reused by node + summary)

mobile/app/watch/[id].tsx         (Player)
  - YoutubePlayer + scrub bar + kicker/title/era/blurb + mark-watched + prev/next
mobile/components/home/watch-card.tsx         (Continue-watching / fallback card)
  - dropped into app/(tabs)/today.tsx near MoodCheckIn / Find-peace
```

Deps to add: `react-native-youtube-iframe`, `react-native-webview`, `react-native-svg` (all Expo-Go-safe; install via `npx expo install`). `expo-image`, `expo-router`, `@react-native-async-storage/async-storage`, `Ionicons`, `haptics` already present.

---

# PART B — ALTERNATIVES (main screen) WITH TRADEOFFS

### Option A — **Segmented control + straight vertical timeline**  ← RECOMMENDED
- **Pros:** clearest "pick one of two tracks"; the timeline is the feature's identity and matches the "chronological" framing; airy rows on a spine match the app's existing list aesthetic (Qur'an surahs) and the Stories progress language; fully buildable with FadeIn/LayoutAnimation + a ~50-line switcher + optional SVG ring; per-track "3 of 10" is unambiguous because one track shows at a time.
- **Cons:** thumbnails are smaller (112×63) than a poster grid; the custom connector logic is a little fiddly (mitigated by the per-row two-half approach in §5).
- **Best when:** the content is genuinely sequential and progress matters — which is exactly this feature.

### Option B — **Segmented control + "continue watching" hero rail + plain chapter list (no spine)**
- **Layout:** under the switcher, a big 16:9 **continue-watching hero** (current chapter, large thumb, resume bar, "Resume" button), then chapters as **boxed cards** (the Stories card style: thumb-left, title, era, duration, ✓) in a simple vertical list — **no timeline spine**.
- **Pros:** the hero is the most "lean-back/streaming" feel (MasterClass/Netflix); boxed cards are dead-simple to build (no connector math); larger thumbnails feel premium.
- **Cons:** **loses the timeline metaphor** the user explicitly wants ("this app is a timeline"); a flat list of episodic history reads as "playlist," not "journey"; more vertical space per item → more scrolling; two strong progress affordances (hero + per-card) can feel redundant.
- **Best when:** you'd rather optimize for "resume my video" than "see the whole arc." Good fallback if connector rendering becomes a time sink.

### Option C — **Stacked sections (both tracks visible) with sticky era headers**
- **Layout:** no switcher; one long scroll: a "Seerah" section (timeline) then a "History" section (timeline), each with its own progress summary and sticky `SectionList` headers.
- **Pros:** everything discoverable without a tap; `SectionList` gives sticky headers cheaply; good if a user wants to browse across both.
- **Cons:** very long scroll; "where am I" gets fuzzy; the segmented control's satisfying tactile switch (which the user values) is gone; harder to make either track feel like a focused journey; the Home card's "continue" still has to disambiguate track anyway.
- **Best when:** there are only a handful of chapters total and you want zero navigation.

**Recommendation restated:** ship **Option A**. It's the only one that honors the explicit "timeline" intent, keeps per-track progress legible, reuses the app's calm list aesthetic + existing motion, and is fully Expo-Go/$0 buildable. Keep Option B's **continue-watching hero** idea in your pocket — if you want more visual punch later, add a single hero **above** the Option A timeline without giving up the spine.

---

# PART C — INSPIRATION NOTES (what justifies the above)

Concrete, reusable patterns extracted per app, each tagged with *what makes it work* and how it maps here.

### Duolingo — learning path / units (the timeline backbone)
- Moved from a branching "tree" to a **single linear path** to "remove the guess-work" — one clear next step. **→** Our straight vertical spine over a fancy branching path: one obvious "next chapter."
- The path is a **vertical sequence of nodes**; **completed nodes are visually filled** and the path reads as progress. Units are chunked by **section/unit headers** along the way. **→** Our filled-accent watched nodes + "filled path" connector tint + optional era group headers (esp. for History's Rashidun/Umayyad/Abbasid eras).
- *What makes it work:* the node **is** the progress indicator and the **completed trail is visible at a glance** — motivating without a separate dashboard. We copy this; we deliberately **skip** Duolingo's playful S-curve and game styling to stay reverent.

### MasterClass — lessons & continue watching (player-adjacent patterns)
- A dedicated **"Continue Watching"** section at the top of progress, plus tap-a-thumbnail → overview → "Play," with all lessons listed below; **progress bars** mark how far through each lesson you are. **→** Our Home "Continue watching" card (State A) and per-card resume bar.
- *What makes it work:* the **single most likely action (resume)** is the most prominent thing; progress is shown as a thin bar on the item, not a number to parse. We mirror both.

### Apple TV — episode rows (status iconography)
- Apple TV's details page shows **checkmark overlays for watched** episodes and a **progress-line overlay for partially-watched** ones, with a thumbnail + resume bar. **→** Our node ✓ for watched, ring/mini-bar for in-progress, exactly this two-state language.
- *What makes it work:* **binary "done" (✓) vs "in progress" (line)** is instantly legible and universally understood. We adopt the same two cues.

### Netflix — continue watching & resume
- "Continue Watching" row with a **resume progress bar on each tile**; the most-recent item floats to the front. **→** Same as our Home card; `continueChapter()` returns the most-recently-updated in-progress chapter.
- *What makes it work:* zero-thought resume. We keep it to **one** card (calm), not a whole rail.

### Coursera — modules, lessons, checkmarks
- Course outline is **modules → lessons** with **completion checkmarks** and a learner dashboard tracking progress. **→** Our (optional) **era group headers** = "modules," chapters = "lessons," ✓ = completion. Validates grouping History's chapters under era headers.
- *What makes it work:* hierarchy (module → lesson) helps when there are *many* items; we apply it only where the list is long (History), and keep Seerah as one flowing sequence.

### Segmented control (Apple HIG / Mobbin) — the track switcher choice
- Use a segmented control to **switch between alternate views of the same kind of content**, **2–5 options max**; beyond that, use another component. Tabs are for "different sections/different information." Chips are for **filtering/multi-select**. **→** Two mutually-exclusive tracks of the same content type = textbook segmented control; chips would imply multi-select, tabs would imply different app sections.
- *What makes it work:* the **sliding selected pill** gives tactile feedback and makes the binary choice obvious — aligning with the app owner's stated love of tactile micro-interactions.

### Islamic apps (Bayyinah TV, Yaqeen) — what to beat
- Bayyinah TV organizes content into **series → episodes/lessons** and users explicitly value being able to **track progress** — but reviewers report **weak watch-progress tracking and playback issues**. Yaqeen is praised for being **"nicely organized."** **→** Our explicit per-chapter ✓ + per-track "3 of 10" + resume bar is precisely the gap these apps leave; "nicely organized" is the bar to clear, and the timeline + clean rows aim above it.
- *What makes it work (by omission):* the lesson here is that **reliable, visible progress** is the differentiator in this category — so we make progress a first-class, three-layer system (node, mini-bar, track summary), not an afterthought.

---

## Sources
- [Duolingo — Introducing the new learning path](https://blog.duolingo.com/new-duolingo-home-screen-design/)
- [duoplanet — The Duolingo Learning Path, what it is & how it works](https://duoplanet.com/duolingo-learning-path/)
- [MasterClass Help — Managing Your Class Progress (Continue Watching)](https://www.masterclass.com/help-center/masterclass/answers/managing-your-class-progress--id---_w7CkGpS22PrV3Fi6khLQ)
- [Apple Support — Start watching on the Home screen in the Apple TV app](https://support.apple.com/guide/tv/explore-watch-now-atvbe160da08/tvos)
- [Apple TV App and Universal Search Guide (watched checkmark / progress-line overlays)](https://help.apple.com/itc/tvpumcstyleguide/en.lproj/static.html)
- [Netflix Help — Continue Watching row](https://help.netflix.com/en/node/115312)
- [Apple HIG — Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)
- [Mobbin — Segmented Control: best practices & variants](https://mobbin.com/glossary/segmented-control)
- [Eleken — Tabs UX best practices](https://www.eleken.co/blog-posts/tabs-ux)
- [react-native-youtube-iframe — docs (Expo support, props, onChangeState)](https://lonelycpp.github.io/react-native-youtube-iframe/)
- [react-native-youtube-iframe — npm](https://www.npmjs.com/package/react-native-youtube-iframe)
- [Bayyinah TV — App Store listing](https://apps.apple.com/us/app/bayyinah-tv/id1530635769)
- [Yaqeen Institute — App Store listing](https://apps.apple.com/us/app/yaqeen-institute/id1341006949)
- [Coursera — Learn UI Design (course outline / progress patterns)](https://www.coursera.org/learn/learn-ui-design)
