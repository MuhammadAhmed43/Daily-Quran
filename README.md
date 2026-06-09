# Daily Qur'an

A privacy-first Qur'an study app for iOS, built with React Native (Expo). Read
the Qur'an offline with verified text, get accurate prayer times with adhan
reminders, and ask a *grounded* AI study companion that answers from cited
verses without ever fabricating scripture.

> **Status:** in active development. This repository documents the build
> end to end, from architecture decisions through each feature.

## Why this app is different

- **Verified text, never AI-generated.** Qur'anic text is rendered from a
  verified, integrity-checked dataset (114 surahs / 6,236 ayahs, Hafs/Kufan
  numbering). The planned AI layer *retrieves and cites* verses from this
  dataset — it never generates scripture, because free LLMs reproduce Qur'anic
  Arabic incorrectly the majority of the time.
- **Privacy-first.** Reading and prayer times run entirely on-device, offline.
  No tracking, no selling data.
- **Built with care for the subject.** Source attribution, narration grading,
  and a fully figure-free (aniconic) approach to any visual content — see
  [ARCHITECTURE.md](ARCHITECTURE.md).

## Features

- ✅ **Qur'an reading** — all 114 surahs, verified Uthmani script + Pickthall
  translation, right-to-left rendering, fully offline.
- ✅ **Prayer times** — on-device calculation ([adhan-js](https://github.com/batoulapps/adhan-js))
  for your location, a live next-prayer countdown, and local adhan
  notifications. Selectable calculation method & madhab (default: Muslim World
  League · Shafiʿi).
- ✅ **Grounded AI study chat** — retrieval-augmented answers that cite real
  verses + classical tafsir (never generates scripture), plus a **voice mode**
  and **photo reflection**.
- ✅ **Stories, plans & habit** — aniconic prophet stories with narration, a
  personal Qur'an reading plan, guided journeys, a daily verse, streaks, a quiz,
  and a community "Ameen" wall with account sync.

## Tech stack

- **App:** React Native (Expo SDK 54), TypeScript, Expo Router
- **Prayer times:** adhan-js (pure-JS, offline)
- **Backend:** Supabase (Postgres + pgvector) · Vercel serverless · Groq
  (free-tier LLMs) — deployed and live
- **Data:** Tanzil Uthmani text (CC BY) + Pickthall translation (public domain),
  via alquran.cloud

## Run it on your phone (≈ 2 minutes)

No Xcode, no native build, no Apple Developer account — the app runs in **Expo Go**,
Expo's runtime for React Native apps.

**You need**
- [Node.js](https://nodejs.org) **≥ 20.19**
- The free **Expo Go** app on your phone — [iOS](https://apps.apple.com/app/expo-go/id982107779) · [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)

**Steps**

```bash
git clone https://github.com/MuhammadAhmed43/Daily-Quran.git
cd Daily-Quran/mobile
cp .env.example .env      # public config so the app reaches the live backend (no secrets)
npm install
npx expo start
```

Then **scan the QR code** in the terminal with your phone's Camera (iOS) or the Expo Go
app — the app opens right on your device. That's it.

- 🖥️ **On a Mac you don't even need a phone:** press **`i`** in the Expo terminal to open it in the iOS Simulator.
- 📶 If the QR won't connect (phone + computer on different networks, or a firewall): run **`npx expo start --tunnel`**.
- ☁️ It runs against the **live deployed backend** (Vercel + Supabase), so the grounded AI chat, voice, prayer times, reading, stories, and study plans all work immediately — sign in with Google, or just tap **"Continue as guest"** to jump straight in.

## Optional: run it as a real native build

You don't need this to review the app — Expo Go above is the easy path — but the
project builds to a native app too (no custom native modules beyond standard
Expo / React-Native ones).

**On a Mac — free, no paid Apple account:**

```bash
cd mobile
npx expo run:ios             # iOS Simulator
npx expo run:ios --device    # ...or onto a plugged-in iPhone (sign with a free Apple ID, 7-day)
```

`expo run:ios` auto-generates the native `ios/` project (`expo prebuild`) and
builds it with Xcode. For the **--device** path, if Xcode asks about signing,
open `mobile/ios` in Xcode once → **Signing & Capabilities → Team → your (free)
Apple ID**, then re-run. Android (any OS): `npx expo run:android`.

> The repo also includes a GitHub Actions workflow
> ([`.github/workflows/ios-unsigned.yml`](.github/workflows/ios-unsigned.yml))
> that builds an **unsigned `.ipa`** for sideloading without a Mac — that was for
> the author's Windows setup; on a Mac, `expo run:ios` above is far simpler.

## Architecture & decisions

The full, independently fact-checked architecture — RAG design, model/provider
choices, the aniconic visual policy, domain-accuracy guardrails, and the
"why X not Y" rationale for every major decision — lives in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Acknowledgements

Qur'anic text © the Tanzil project (CC BY); English translation by Marmaduke
Pickthall (1930, public domain). Prayer-time calculations by adhan-js.
