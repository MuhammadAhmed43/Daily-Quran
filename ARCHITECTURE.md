# Qur'an AI Study App — Final Verified Architecture Decision Log

*Lead-architect synthesis after independent verification + adversarial red-team (33 agents, June 2026).*
*Constraints: React Native (Expo Go) + Supabase + Vercel · iOS · $0 budget · religiously sensitive.*

The core architecture survives: **local-first verified text + retrieval-grounded AI, never generate scripture, fully aniconic visuals, human scholarly review.** What changed is mostly *numbers and named products* — several free-tier limits and "use X instead" recommendations were corrected or reversed. **Treat every cited free-tier quota as a measure-it-yourself value, not a guarantee.**

---

## Layer 1 — Retrieval (embeddings, reranking, offline text)

### Verified Arabic text + numbering
**Decision:** Use **Tanzil `quran-uthmani.txt`** (CC BY 3.0, verbatim-only) as the canonical Arabic source. Lock all keys to **Hafs/Kufan 6,236-verse `sura:ayah`** notation end-to-end. Bismillah in surahs 2–114 is *display-only text co-located with verse 1*, never a separately keyed row. Never mix with Warsh (6,214) or Flügel numbering. **Confidence: high.**
- **Explicitly the Uthmani variant, not Simple/Imla'i** — the Simple variant normalizes orthography away from the Medina Mushaf rasm and is indefensible to a religious reviewer.
- Uthmani Unicode requires a proper Quranic font (me_quran / KFGQPC Hafs) via expo-font, or iOS renders boxes/wrong forms. Test on a physical device.
- Tanzil's CC BY 3.0 requires a **live tappable link to tanzil.net** in the app, even for a bundled offline dataset.
- QUL = download hub, **no public API**. KFGQPC raw-text licensing via GitHub mirrors is **legally unclear** (font license ≠ text license); only safe via Tanzil. Quran Foundation API needs OAuth2 approval. alquran.cloud has no SLA — supplementary only.

### Offline bundle
**Decision:** Local-first reading core, online AI layer. Bundle Arabic text (~1.47 MB JSON) and **seed expo-sqlite programmatically via `onInit`** (preferred over shipping a `.db` binary). **Confidence: medium** (the original claim over-bundled).
- **Text/reading** → fully offline. WAL mode + single batched transaction in `onInit`, hold splash with `preventAutoHideAsync()`, gate re-seed behind a version flag.
- **Search** → diacritic-stripped shadow column + `LIKE` for MVP. Custom FTS5 Arabic tokenizers need a native dev build and are **not loadable in Expo Go**.
- **Recitation audio** → **do NOT bundle** (one reciter ≈ 400–600 MB, exceeds Apple's 200 MB cellular cap). Stream from QuranicAudio.com / Quran.com CDN; offer optional per-surah download.
- Watch open expo-sqlite bugs: FTS close-crash (#38168), Suspense/nav flash (#37169). Pin a known-good version; test in iOS Release mode.

### Embeddings
**Decision:** **Pre-embed the fixed 6,236-verse corpus offline with BGE-M3** (Apache-2.0, 1024-dim, 8192-token; best Arabic Quran-Tafseer retrieval at 82.72) via free Colab/HF; store vectors in Supabase pgvector (~25.5 MB). At **query time use the same model** (BGE-M3 on CPU ~300–500 ms, or re-embed corpus with a smaller model). **Confidence: high.**
- gte-small (English-only, 384-dim) is rejected. Multilingual models beat Arabic-specific models on every free benchmark tested.
- multilingual-e5-large's **512-token cap** hurts tafsir passages; avoid as primary.
- **Same-model footgun:** corpus and query vectors must come from the identical model or retrieval silently degrades.

### Reranker
**Decision:** **Default to NO reranker.** If added, use **FlashRank** (MIT, CPU) in a Vercel **Python** function — *not* bge-reranker-v2-m3. **Confidence: low** that reranking helps here. **(OVERTURNED.)**
- bge-reranker-v2-m3 gives only **+0.73 on Quran-Tafseer** (−0.92 on a comparable set) — negligible; and **257 s to rerank 100 docs on CPU** (> Vercel's 300 s timeout), ~570 MB weights exceed Vercel's 500 MB Python limit.
- Earlier "4 MB bundle limit" was wrong (that's request-*body* size; real limits are 250 MB Node / 500 MB Python). Cohere trial = non-commercial only.
- **Benchmark on actual Quran data before enabling; if negligible, invest in chunking/embedding instead.**

---

## Layer 2 — Grounding / Faithfulness

### Render scripture from DB, never generate
**Decision:** **Hard, code-enforced rule.** Render Qur'anic text exclusively from the verified DB; never let an LLM emit verse bytes. **Confidence: high.**
- Weak/mid free-tier models score **26–41%** on verse *recognition* (IslamicMMLU); even specialist Arabic 7B models under RAG hit only **65–82% correct Ayahs** — 1-in-5 to 1-in-3 wrong. Even 1% × 6,236 ≈ 62 misquotes.
- **Strike the "4.77% / IslamicEval / Llama-3.1-8B" figure** — unverifiable in any indexed source. Cite the 26–41% recognition and 65–82% specialist-RAG ranges instead.

### Faithfulness gate
**Decision:** **Prompt-first, layered.** (1) DB-render by ID; (2) **system-prompt grounding** requiring every theological claim to carry an explicit verse ID, refusing uncited assertions; (3) optional **LLM-judge** faithfulness call as a *prototype* guardrail. **Do NOT use a generic mDeBERTa NLI model as the primary gate.** **Confidence: medium.** **(CHANGED — NLI demoted.)**
- Zero-shot NLI fails here: "Semantic Illusion" (~100% FPR at 95% recall on real hallucinations), ~76% Arabic accuracy that understates the Classical-Quranic gap, 10–30 s HF cold starts; IslamicEval 2025 winners used fine-tuned LLMs, not NLI.
- "Abstain on failure" must be **explicitly coded**; err toward abstention (a false-pass is worse than a false-refusal).
- **No zero-budget, zero-latency mechanism gives production-grade faithfulness on Classical Quranic theology — disclose this; production needs a fine-tuned model + human scholar review.**

---

## Layer 3 — Models / Providers

### LLM provider strategy
**Decision:** **Primary: Groq `gpt-oss-120b`** (no training on user data; constrained JSON — **add client-side validation + retry**, ~10% `json_validate_failed`; correct free limit **1,000 RPD**). **Privacy fallback: Cloudflare Workers AI** (confirmed no-training; ~10K Neurons/day; **Cloudflare-hosted models only** — proxied models bill at full rate). **Drop Cerebras** (Qwen3-32B deprecated Feb 2026; Qwen3-235B deprecated May 27 2026). **Confidence: medium.** **(CHANGED.)**
- OpenRouter free Qwen3-235B = 50 req/day shared = testing only. A $10 deposit (~1,000 req/day) is the only practical path to Qwen3-235B at scale.
- Groq Llama 3.3 70B free tier is only **12K TPM** — Arabic + tafsir context can saturate it; benchmark realistic prompt sizes.

### Gemini specifically
**Decision:** **Do not use Gemini free tier for user religious content.** **Confidence: high** on privacy; **low** on rate numbers. **(CHANGED.)**
- **Decisive:** unpaid tier uses prompts/outputs for training + human review, **no opt-out**; apps serving **EEA/UK/CH** end users must use **paid** services.
- **Rate limits are unknowable from public sources** — plan a conservative floor (~10 RPM, ~250–500 RPD), verify in your own AI Studio dashboard, build graceful 429 handling.

---

## Layer 4 — Storyboard / Visuals (Aniconism)

**Decision:** **Tiered aniconism, curated + human-reviewed, no on-the-fly AI generation of sacred scenes.** **Confidence: high.**
- **Tier 1 — zero tolerance:** any depiction of any prophet in *any* form (silhouette, back-of-head, faceless, shadow, AI-generated). The **Majidi precedent is decisive** — Al-Azhar / Muslim World League condemned even infant limbs and back-of-head.
- **Tier 2 — default avoid:** any hand-drawn/AI animate beings. Use geometry, calligraphy, architecture, nature.
- **Tier 3 — permissible with care:** photographs of *anonymous* contemporary humans — but keep the storyboard fully aniconic; confine any human photos to onboarding/profile.
- **Negative prompts are not a safety mechanism.** FLUX.1-schnell is guidance-distilled (CFG=0) and ignores them. Architecture: **server-side prompt allowlist + curated CC0 art; never rely on negative prompts.**
- **New:** Egypt's Dar al-Ifta (Jan 2026) **banned AI for Qur'an interpretation** — the human-review requirement extends to the **AI tafsir/study-text layer**, not just images.

---

## Layer 5 — Infrastructure / Client

### Supabase auto-pause
**Decision:** Free projects auto-pause after **7 days** inactivity (manual-only restore; **90-day hard-delete** after). Keep alive with an **external GitHub Actions cron every 3–4 days** hitting a real DB endpoint (`/rest/v1/<table>?select=id&limit=1`). **Confidence: high.**
- **Do NOT use Supabase pg_cron / internal cron** — Postgres is off while paused, so it can never wake itself. The scheduler must be external.
- README note for the reviewer: "If the app is unresponsive, open the Supabase dashboard and restore the project first."

### Vercel Hobby limits
**Decision:** Function duration **300 s** *only with Fluid Compute* (default for projects created after Apr 23 2025). Edge first-byte ≤ 25 s. **Rate-limit AI endpoints aggressively.** **Confidence: medium.** **(CHANGED.)**
- **Binding constraint = Provisioned Memory: 360 GB-hrs/month.** A 2 GB function streaming 300 s ≈ 0.167 GB-hrs → ~**2,160 long streams/month (~72/day)**, far below the 1M-invocation cap. Rate-limit to ~50–100 AI queries/day globally.
- The earlier **"128 MB Edge memory cap" was fabricated** — standalone Edge Functions are deprecated; use the Node.js runtime (2 GB).
- Hobby is **non-commercial per ToS** — fine for a take-home POC, not a shipped product.

### iOS delivery
**Decision:** **Expo Go is the only free iOS path** (Windows + iPhone + no Mac + no paid Apple account). Scope it as a **UI/data-layer demo**. **Confidence: high.**
- Free Apple ID dev certs expire in **7 days**; Expo Go can't do **background audio**, **on-device STT**, or **custom native modules**. expo-av deprecated (removed SDK 55) → **expo-audio** (foreground works in Expo Go).
- **Correction:** iOS push notifications are **NOT** removed from Expo Go — only *Android* lost it in SDK 53. Don't claim both.
- **Background audio is the critical gap for a recitation app** — Expo Go's binary doesn't declare the `audio` UIBackgroundMode. Document it; production needs $99/yr Apple Developer + EAS, or a Mac.

### Audio / STT
**Decision:** Record with **expo-audio**, transcribe server-side. For a **demo**, Groq Whisper with a disclaimer. For anything serious, a **diacritic-preserving, Quran-fine-tuned Whisper** (e.g. tarteel-ai/whisper-base-ar-quran ~5.75% WER). **Confidence: medium.** **(REVERSED.)**
- **Do NOT use Deepgram Nova-3** — it **strips diacritics** by design; Quranic correctness depends on tashkeel/Tajweed → disqualifying.
- Groq Whisper: 2,000 RPD + 7,200 audio-sec/hour (the hourly audio cap binds first). Base Whisper Arabic ≈ 37% WER.

---

## Layer 6 — Domain / Content

### Translation choice + licensing
**Decision:** **Multi-translation selector, no single hardcoded default. Default to the 1930 Knopf Pickthall (treat as US public domain).** **Confidence: high.** **(CHANGED — Pickthall upgraded.)**
- **Pickthall** (Knopf, New York, 1930): US-first-published → URAA restoration likely doesn't apply; never renewed → US PD. Cleanest free clean-text option.
- **Saheeh International**: Salafi-coded (poor *neutral* default) and all-rights-reserved; serving via API doesn't shield redistribution liability. Option only.
- **The Clear Quran**: **CC BY-NC-ND** — unavailable for a potentially-commercial app without permission.
- **Abdel Haleem**: OUP all-rights-reserved → paid license.
- **Yusuf Ali**: US status genuinely uncertain (URAA likely restored to ~2033). Don't bundle.
- fawazahmed0/quran-api is permissive on *code* (Unlicense) but carries **no copyright disclaimer on texts** — doesn't transfer risk.

### Asbab al-Nuzul
**Decision:** **Never present al-Wahidi flatly as "the reason this verse was revealed."** Label all asbab as **"reported context from classical sources; not all narrations are authenticated,"** and handle the **>87% no-asbab case as the normal state.** **Confidence: medium.** **(CHANGED.)**
- al-Wahidi (not a muhaddith) carries weak/fabricated narrations. Per-narration grading is right *in principle*.
- **But "prefer Bukhari/Muslim asbab as highest weight" is incoherent** — sahih asbab narrations contradict each other within those collections (the genre is exegetical, not historiographical).
- **Drop al-'Ujab** (incomplete, Arabic-only) and **Sunnah.com API auto-crossref** (no verse-lookup endpoint). Resolve altafsir.com Guezzou-translation licensing before embedding; al-Suyuti's Lubab (PD Arabic) is a safer base.

---

## Cross-cutting principles
1. **Treat every free-tier number as measure-it-yourself** — build graceful 429/degradation everywhere.
2. **Human scholarly review is non-negotiable** — for *both* visual assets and AI tafsir/study text (Dar al-Ifta Jan 2026 AI-interpretation ban).
3. **Scope the demo honestly in the README** — Expo Go limits, Supabase pause behavior, "AI features are prototype-grade, not a production faithfulness guarantee." Overclaiming is the fastest way to fail a sharp review.

---

## Verified decisions — quick reference

| Item | Decision | Confidence |
|---|---|---|
| Arabic text + numbering | Tanzil Uthmani (not Simple), Hafs/6236 locked, Bismillah on v1 | high |
| Offline bundle | Local-first text via JSON-seeded expo-sqlite; stream audio; LIKE search MVP | medium |
| Embeddings | BGE-M3 offline → pgvector; same model at query time; gte-small rejected | high |
| Reranker | Default none; FlashRank if needed (not bge-reranker) | low |
| Render scripture from DB | Hard code-enforced; LLM never emits verse text | high |
| Faithfulness gate | Prompt-grounding + verse-ID citations + optional LLM-judge; not zero-shot NLI | medium |
| LLM providers | Groq gpt-oss-120b primary; Cloudflare privacy fallback; drop Cerebras | medium |
| Gemini free tier | Do not use for user religious content | high |
| Aniconism / storyboard | Tiered, fully-aniconic curated, human-reviewed, no on-the-fly gen | high |
| Supabase auto-pause | External GitHub Actions cron on a real DB query; never pg_cron | high |
| Vercel limits | 300s (Fluid Compute); rate-limit; Provisioned Memory is the binding cap | medium |
| iOS delivery | Expo Go scoped UI/data demo; document background-audio gap | high |
| Audio / STT | expo-audio + Groq Whisper (demo) / Quran-fine-tuned Whisper (prod); not Nova-3 | medium |
| Translations | Multi-selector, default 1930 Pickthall (likely US PD) | high |
| Asbab al-Nuzul | Label all as unauthenticated reported context; no flat "reason revealed" | medium |

---

## What the red-team changed (corrections to the earlier audit)
- **Reranker — OVERTURNED.** bge-reranker-v2-m3 gives only +0.73 on Quran-Tafseer and can't run inside Vercel's limits. Default to none.
- **STT — REVERSED.** Deepgram Nova-3 strips diacritics → disqualifying for Quranic Arabic. Use a Quran-fine-tuned Whisper.
- **Faithfulness gate — CHANGED.** Zero-shot NLI demoted (≈100% FPR on real hallucinations); prefer prompt-grounding + LLM-judge.
- **Cerebras — DROPPED.** All free Qwen3 models deprecated by May 2026.
- **Gemini rate limits — DOWNGRADED to low confidence.** Unknowable from public sources; plan a conservative floor.
- **Vercel binding limit — CHANGED.** It's Provisioned Memory (≈72 long streams/day), not invocations; "128 MB Edge cap" was fabricated.
- **Scripture-hallucination stat — STRUCK.** The "4.77%" figure is unverifiable; use 26–41% / 65–82% instead.
- **Pickthall — UPGRADED** from "ambiguous" to "likely US public domain."
- **Asbab implementation — CHANGED.** "Prefer Bukhari/Muslim asbab" is incoherent (sahih narrations contradict each other).
- **Offline bundle — NARROWED.** Audio can't be bundled; robust Arabic search needs a native FTS tokenizer unavailable in Expo Go.
- **iOS push — CORRECTED.** Only Android lost Expo Go push in SDK 53; iOS retains it.

---

## Interview defense pack — "why X not Y"

**Why render scripture from the DB instead of generating verses?**
Free-tier-accessible models score 26–41% on verse recognition (IslamicMMLU) and even specialist Arabic 7B models under RAG only 65–82% correct verbatim Ayahs. Even a frontier model's 1% error across 6,236 verses is ~62 misquotes. Verse bytes are rendered from a verified Tanzil DB by ID; the LLM never emits them. (I avoid the circulated "4.77%" figure — unverifiable.)

**Why not negative prompts to stop AI depicting prophets?**
FLUX.1-schnell is guidance-distilled (CFG=0) and ignores negative prompts — a no-op by architecture; negative-prompt safety is broadly unreliable even in CFG models. The Majidi precedent (Al-Azhar condemned even an infant's limbs/back-of-head) means I don't generate sacred scenes at all — curated, human-reviewed, fully-aniconic library + server-side allowlist.

**Why Groq over Gemini?**
Privacy: Gemini's unpaid tier trains on prompts with human review, no opt-out — unacceptable for personal spiritual queries — and EEA/UK/CH users legally require the paid tier. Groq doesn't train on user data. And Gemini's free limits aren't publicly guaranteed, so I won't architect against an unverifiable number. I handle Groq's ~10% JSON-validation failures with client-side validation + retry.

**Why prompt-grounding + LLM-judge instead of an NLI model?**
Zero-shot NLI reaches ~100% FPR at 95% recall on real hallucinations and ~76% Arabic accuracy (worse on Classical Quranic). IslamicEval 2025 winners used fine-tuned LLMs, not NLI. Primary gate is zero-latency verse-ID citation enforcement; LLM-judge is an explicit *prototype* layer — that honesty is the defensible position.

**Why Pickthall as default and not Saheeh / Clear Quran?**
Saheeh is Salafi-coded and all-rights-reserved (API serving doesn't shield redistribution). Clear Quran is CC BY-NC-ND (non-commercial, no-derivatives). The 1930 Knopf Pickthall was US-first-published (URAA likely N/A) and never renewed — cleanest free clean-text. The real answer is a multi-translation selector with no hardcoded default.

**How do you keep the Supabase demo alive a week later?**
Free projects auto-pause after 7 days (manual restore). A GitHub Actions cron every 3–4 days hits a real DB endpoint — external, because Postgres is off while paused so internal pg_cron can't wake itself. README tells the reviewer to restore from the dashboard if unresponsive.

**Why is Expo Go acceptable for a recitation app needing background audio?**
Only as an explicitly-scoped UI/data demo. On Windows + iPhone + no Mac + $0 it's the only frictionless free path. Background audio fails because Expo Go's binary doesn't declare the iOS `audio` UIBackgroundMode — no config plugin patches a compiled binary. Production needs an EAS dev build. (iOS push still works in Expo Go; only Android lost it in SDK 53.)

**Why not trust Bukhari/Muslim asbab as authoritative context?**
Isnad grading screens the chain, not content coherence — and the asbab genre is exegetical, not historiographical. Documented sahih asbab narrations contradict each other (e.g. Q.66:1, Q.9:113). So all asbab are labeled "reported context, not all authenticated," and the 87%+ of verses with no asbab are treated as the normal state.

**What's the real cost limit on the Vercel streaming endpoint?**
Not invocations or bandwidth — Provisioned Memory at 360 GB-hrs/month. A 2 GB function streaming 300 s ≈ 0.167 GB-hrs → ~72 long streams/day. So AI endpoints are rate-limited at middleware to ~50–100/day globally; Node.js runtime (not deprecated Edge), Fluid Compute on.

---

## Open questions — verify/measure yourself before committing
1. Actual Gemini & Groq free-tier limits for this project (check your AI Studio dashboard; benchmark Groq's 12K-TPM tier on realistic Arabic+tafsir prompts).
2. Whether reranking helps at all on this corpus (benchmark FlashRank gain on real Quran data).
3. BGE-M3 query-time latency on HF free CPU (~300–500 ms) — acceptable, or re-embed with a smaller model?
4. iOS rendering of Tanzil Uthmani Unicode with the chosen Quranic font on a physical device.
5. expo-sqlite production stability (bugs #38168, #37169) — pin a version, test in iOS Release mode.
6. Quran-fine-tuned Whisper WER + HF-free reliability on real recitation audio.
7. altafsir.com Guezzou al-Wahidi translation licensing (Royal Aal al-Bayt) — or use PD Lubab Arabic.
8. Whether the reviewer's background affects the Tier-3 human-photography call — safest: fully aniconic storyboard.
9. Whether to surface the Rippin-school meta-caveat (asbab as post-hoc exegesis) to users, or only narration-level grades.

---

## Layer 7 — Product features

### App section map
```
Home    → Verse of the Day · next-prayer countdown
Chat    → grounded Q&A (RAG over verified Qur'an)
Stories → aniconic storyboard + narration + timeline
Journal → write your day → comforting verses (safety-gated, private)  [phase 2]
Prayer  → times · adhan notifications · Qibla
```

### Storyboard narration (auto-generated, no self-recording)
- **Pre-generate** narration with **Kokoro-82M** (Apache-2.0, commercial-safe, free Colab ~36× real-time); **Piper** (CPU) fallback. Cache MP3s in Supabase Storage / bundle. **Confidence: high.**
- **Third-person narrator only** — never voice-act a prophet (audio equivalent of the aniconism rule).
- **Music-free** — instrumental music is a credibility landmine for this audience; use subtle natural ambience or silence. Human listen-through before a story ships.
- Verse **recitation is always real reciter audio** (EveryAyah/QuranicAudio), never TTS.
- `expo-speech` = live read-aloud for **chat answers only**, not stories.
- Sequencing via `expo-audio` (narration → recitation → auto-advance); autoplay + manual modes. **Background playback (screen locked) needs a dev build — Expo Go = foreground only.**

### Daily Quotes ("Verse of the Day")
- **Curated, verified, human-reviewed pool** (~120–365 reflective verses + translation + optional 1-line context).
- **Rotated deterministically by date — never an LLM pick** (eliminates out-of-context/fabrication risk).
- Aniconic **shareable card** (calligraphy + verse + reference, never cropped). Works **offline**. Home-screen widget later (needs dev build).
- Keep to verses (or *graded* content) only.

### Journal → Verses (highest-risk feature — build safety-first, phase 2)
- **Flow:** entry → embed → retrieve from a **curated "comfort index"** (verses human-tagged by theme: anxiety, grief, gratitude, hardship, hope, forgiveness, patience, guidance) → present **1–3 verses with context**, gently framed.
- **Prefer embedding + curated index over a generative LLM** (cheaper, more private, avoids cherry-picking).
- **Non-negotiable guardrails:**
  1. **Crisis detection FIRST** — self-harm/suicide/abuse/severe distress → surface **real help (hotlines/resources) before verses**; scripture never replaces professional help.
  2. **Gentle, non-prescriptive framing** ("verses many find comforting"); no prosperity-gospel, no judgment, no implying scripture is a quick fix.
  3. **Privacy paramount** — the journal is the most sensitive data in the app: **store local-first / encrypted**; if any text reaches an LLM, only a **no-training provider (Groq/Cloudflare)**, with explicit consent + plain-language policy.
  4. **No diagnosis, no fatwa**, clear "reflection, not therapy" disclaimer.
  5. **Curated, human-reviewed** comfort index + templated framings.

### Prayer-time (Namaz) notifications — feasible in Expo Go
- **Calc:** **adhan-js** (batoulapps, MIT, **pure JS, offline, high-precision** from Meeus). Use pure adhan-js (NOT native `react-native-adhan`) to stay in Expo Go. User-selectable **calculation method + madhab** (Asr differs Hanafi/Shafiʿi); location via `expo-location`. **Confidence: high.**
- **Notifications:** `expo-notifications` **local/scheduled notifications work in Expo Go on iOS** — only *remote push* was restricted in SDK 53. Schedule a **rolling window** of upcoming prayers (iOS ~64 pending cap); reschedule on app open.
- **Extras:** optional adhan audio on notification, next-prayer countdown on Home, **Qibla direction** (adhan-js).
- **Transparency:** let the user pick + display the method/madhab in use (don't hardcode one — times legitimately differ by region/school).
- **Caveat:** reliable daily auto-reschedule *without opening the app* wants a dev build / background task; Expo Go covers the scoped demo.

### Budget & privacy impact
- **Only Journal touches the LLM** (and can be embedding-only). Prayer times + daily quotes are **100% local/curated** — zero LLM budget.
- The journal makes **privacy a headline feature**: local-first + no-training LLM + clear policy = the **anti–Muslim-Pro** trust wedge.

### Feature scoping
- **v1 spine (build first):** Chat + Storyboard + Verse-of-the-Day + Prayer times — high impact, low risk.
- **Phase 2 flagship:** Journal → Verses — done *safely* (crisis handling + privacy) is real work; don't rush it in front of a reviewer.

---

## Pre-build setup & prerequisites

### Local tooling (confirmed present)
Node v20.18.1 ✓ · npm 11.3.0 ✓ · git 2.47.1 ✓ · Expo Go on the physical iPhone · phone + dev machine on the same Wi-Fi.

### Housekeeping before first commit
1. **Rotate the leaked `STITCH_API_KEY`** in `.mcp.json` (revoke in Stitch console, reissue) and **gitignore** the file. Decide whether Stitch is still used (optional — UI design only).
2. **`git init`** (repo is not yet under version control).
3. **`.gitignore`**: `node_modules/`, `.env*`, `.mcp.json`, `.expo/`, build artifacts.
4. **`.env.example`** documenting required keys (no real values committed).

### Free accounts needed (staged by milestone — none needed for M0)
| Service | Provides | When |
|---|---|---|
| GitHub | repo + Actions cron (Supabase keep-alive) + Vercel deploy | M0 |
| Supabase | Postgres + pgvector + Auth + Storage + RLS | M2 |
| Groq | primary LLM + Whisper STT | M3 |
| Cloudflare | Workers AI (no-training privacy fallback) | M3 |
| Hugging Face | BGE-M3 embedding inference (or batch via Colab) | M2 |
| Vercel | API hosting (Edge/Serverless) | M3 |
| Expo (free) | Expo Go / EAS later | M0 |
| Apple Developer ($99) | standalone build / background audio — **deferred, not now** | post-takehome |

### Data to source once (verified, with attribution)
- **Arabic:** Tanzil `quran-uthmani.txt` (CC BY 3.0 — requires a live tanzil.net link in-app).
- **Translation default:** Pickthall 1930 (likely US PD); licensing matrix for any extras.
- **Tafsir/Asbab:** spa5k/tafsir_api (Ibn Kathir + al-Wahidi, all labeled as graded/unauthenticated context).
- **Recitation:** EveryAyah / QuranicAudio reciter (pick one default).

### Decisions to lock (sensible defaults already chosen)
- Default translation = **Pickthall**; default reciter = TBD; default prayer **method + madhab** = TBD (user-overridable).
