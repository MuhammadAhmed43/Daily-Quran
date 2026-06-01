# Daily Qur'an

A privacy-first Qur'an study app for iOS, built with React Native (Expo). Read
the Qur'an offline with verified text, get accurate prayer times with adhan
reminders, and — coming next — a *grounded* AI study companion that answers from
cited verses without ever fabricating scripture.

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
- 🔜 Verse of the Day, grounded AI study chat (RAG), journal → comforting
  verses, and an aniconic story/timeline view.

## Tech stack

- **App:** React Native (Expo SDK 54), TypeScript, Expo Router
- **Prayer times:** adhan-js (pure-JS, offline)
- **Backend (planned):** Supabase (Postgres + pgvector) · Vercel · free LLM
  providers with privacy routing
- **Data:** Tanzil Uthmani text (CC BY) + Pickthall translation (public domain),
  via alquran.cloud

## Getting started

Requires **Node ≥ 20.19** and the **Expo Go** app on a physical iOS device.

```bash
# 1. (optional) rebuild the Qur'an dataset — self-contained, downloads sources
node scripts/build-quran.mjs

# 2. run the app
cd mobile
npm install
npx expo start          # scan the QR with Expo Go
```

## Architecture & decisions

The full, independently fact-checked architecture — RAG design, model/provider
choices, the aniconic visual policy, domain-accuracy guardrails, and the
"why X not Y" rationale for every major decision — lives in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Acknowledgements

Qur'anic text © the Tanzil project (CC BY); English translation by Marmaduke
Pickthall (1930, public domain). Prayer-time calculations by adhan-js.
