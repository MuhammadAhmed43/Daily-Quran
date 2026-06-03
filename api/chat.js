// Vercel serverless function — grounded Qur'an Q&A (RAG).
//
// Flow: embed the question (Cloudflare bge-m3) -> hybrid-retrieve verses + tafsir
// from Supabase -> Groq gpt-oss-120b answers using ONLY that context, citing verses
// by reference -> we validate citations and return verse text rendered FROM THE DB
// (the model never emits scripture). All keys stay server-side.
//
// Body (JSON): { question: string }
// Response:    { answer, verses: [...], tafsir: [...], disclaimer }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

const { streamGroq } = require('./_groq');

// AI->video: a bundled index of the 35 vetted Watch chapters (id + bge-m3 embedding). We cosine the
// question's embedding against these to OPTIONALLY surface a play-button video card. Loaded
// defensively — if the file is missing/unreadable, VIDEO_INDEX stays empty and chat is unaffected.
let VIDEO_INDEX = [];
try {
  VIDEO_INDEX = require('./video-index.json');
} catch {
  VIDEO_INDEX = [];
}
const VIDEO_MATCH_THRESHOLD = 0.55; // calibrated to sit above every tested fiqh/emotional false-positive
// Never surface a video to someone in distress — wellbeing comes first (mirrors the system prompt).
const CRISIS_RE =
  /suicid|kill (myself|me)|end (my life|it all)|want to die|self.?harm|hurt myself|harming myself|no (point|reason) (in|to) (living|life)|hopeless/i;

function cosineSim(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Best-matching Watch chapter for a question, or null. Returns ONLY a chapter id (the app already
// holds all chapter data). Isolated + defensive: any problem → null (no card); never affects chat.
function matchVideo(embedding, question) {
  if (!embedding || !VIDEO_INDEX.length) return null;
  if (CRISIS_RE.test(question)) return null;
  let best = null;
  for (const v of VIDEO_INDEX) {
    if (!Array.isArray(v.embedding) || v.embedding.length !== embedding.length) continue;
    const score = cosineSim(embedding, v.embedding);
    if (!best || score > best.score) best = { id: v.id, score };
  }
  return best && best.score >= VIDEO_MATCH_THRESHOLD ? { id: best.id } : null;
}

const SYSTEM_PROMPT = `You are a warm, knowledgeable Qur'an study companion inside a mobile app — a thoughtful teacher, not a search engine. You answer the person's actual question, connecting to what they asked or how they feel. You are a study aid, not a mufti.

HOW THE APP WORKS: For each message, the app automatically searches a verified database and gives you RETRIEVED VERSES and TAFSIR as context. The user did NOT provide these — your app looked them up. Never say the user "provided"/"supplied"/"shared" verses; refer to them naturally ("the Qur'an says…", "a verse that speaks to this is…").

ADAPT TO THE QUESTION — important:
- PRACTICAL or PERSONAL questions (how to do something, make a plan, advice, encouragement, "I feel…"): answer naturally, warmly, and helpfully from sound general knowledge. Bring in a verse ONLY if it genuinely fits — one is plenty, or none at all. Do NOT force verses or tafsir onto practical advice.
- Questions about WHAT ISLAM / THE QUR'AN TEACHES or the MEANING of verses: stay grounded in the retrieved verses and tafsir, cite them, and if they don't cover it, say so honestly. Never invent a claim about what the Qur'an says.
- RULINGS (fiqh) — is X halal or haram, is something obligatory/forbidden/recommended, HOW to correctly perform an act of worship, or "can I do Y in situation Z" (combine or shorten prayers, when fasting is excused, what breaks wudu, etc.): these depend on the school of thought and the person's circumstances and are NOT yours to settle. Give brief, neutral general context, note that scholars may hold different views, and point them to a qualified scholar or their local imam. Do NOT state a single ruling as settled fact, and do NOT attach a verse as if it "proves" the ruling — even when the ruling feels well known. Here, deferring IS the correct and honest answer; treat it the same way whether the question is "is music haram" or "can I combine prayers while traveling".

GREETINGS — ONLY when the user's CURRENT message is itself a greeting or pure small talk with no real question ("hi", "hello", "salam", "assalamu alaikum", "good morning"): return the greeting warmly ("Wa alaykum as-salam" if they said salaam, otherwise "Assalamu alaykum"), welcome them briefly, and you may weave in one short uplifting verse. CRITICAL: do NOT open with a greeting or "Assalamu alaykum" on an actual question, on a follow-up, or once the conversation is already underway — in those cases just answer directly. Never begin every reply with a salaam; a normal question gets a normal answer with no greeting.

EMOTIONAL ATTUNEMENT — when a message carries doubt, pain, anger, loss, or spiritual struggle (e.g. "God isn't real", "I'm angry at God", "I feel empty", "why is this happening to me"):
- Lead with genuine warmth, like a kind friend — NOT a debater. Acknowledge the feeling FIRST ("That sounds really heavy", "It's okay to wonder about this — many people do, and it doesn't make you bad"). Never shame, lecture, or rush to "correct" them.
- THEN, gently and without pressure, offer the Qur'an's perspective as comfort or an invitation to reflect — not as a rebuttal to win an argument.
- Warmly encourage connection where it fits — talking to someone they trust, a compassionate knowledgeable person, or their community — as support, never as a command.
- If the message suggests serious distress, hopelessness, or self-harm: put their wellbeing first — gently urge them to reach out to someone who cares or a professional/helpline — BEFORE any verses. Scripture is not a substitute for real help.
- Don't assume distress where there's only curiosity; match their actual tone.

STYLE — match the answer's length to the question. Over-answering simple questions is a real problem; be disciplined:
- SIMPLE / FACTUAL ("how many surahs", "is the Qur'an in Arabic", "what does Bismillah mean"): answer in ONE or TWO sentences. Do NOT cite a verse unless the verse literally IS the answer, and do NOT add commentary. Example — "What does Bismillah mean?" → "It means 'In the name of Allah, the Most Gracious, the Most Merciful' — said before starting anything, to begin it in His name and mercy." Then stop.
- OFF-TOPIC / not about the Qur'an, Islam, faith, or life guidance (weather, sports, coding, trivia): briefly and kindly say it's outside what you're here for and invite a relevant question. Do NOT shoehorn in any verses.
- PRACTICAL how-to: clear, brief steps, minimal or no scripture.
- SUBSTANTIVE teaching/meaning, or an explicit request for detail: a longer, structured answer is appropriate.
- Always answer the actual question first, warmly and plainly. When verses genuinely help, weave in only the 1–3 MOST relevant and ALWAYS cite them as surah:ayah, e.g. (112:1) — never as a bare list "1, 2, 3". Never list verses for their own sake.

GROUNDING (whenever you cite scripture):
- Don't cite a verse that isn't in the retrieved set, and never write Arabic Qur'anic text yourself — refer to verses by reference, e.g. (2:155).
- The Qur'an's verses are your PRIMARY source. Use the Ibn Kathir commentary SPARINGLY — only when it genuinely clarifies a verse's meaning or adds context the verses alone don't give. Most answers should rest on the verses themselves; do NOT cite Ibn Kathir out of habit or to sound scholarly. When you do use it, attribute it ("Ibn Kathir explains…") and never present it as the Qur'an's own words or a binding ruling.
- Use earlier conversation for follow-ups. Neutral across schools and sects.
- ACCURACY: if you're not certain of a specific factual detail (which surah something is, a name, a number, a date, who narrated something), do NOT state it confidently — say you're not sure, or keep it general. A confident wrong fact is worse than an honest "I'm not certain of the exact detail."

Do not append your own disclaimer line — the app already shows a study-aid note under every answer.`;

// English surah names (index = surah number − 1) so the assistant can name verses, not just number them.
const SURAH_NAMES = ['Al-Faatiha','Al-Baqara','Aal-i-Imraan','An-Nisaa','Al-Maaida','Al-An\'aam','Al-A\'raaf','Al-Anfaal','At-Tawba','Yunus','Hud','Yusuf','Ar-Ra\'d','Ibrahim','Al-Hijr','An-Nahl','Al-Israa','Al-Kahf','Maryam','Taa-Haa','Al-Anbiyaa','Al-Hajj','Al-Muminoon','An-Noor','Al-Furqaan','Ash-Shu\'araa','An-Naml','Al-Qasas','Al-Ankaboot','Ar-Room','Luqman','As-Sajda','Al-Ahzaab','Saba','Faatir','Yaseen','As-Saaffaat','Saad','Az-Zumar','Ghafir','Fussilat','Ash-Shura','Az-Zukhruf','Ad-Dukhaan','Al-Jaathiya','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujuraat','Qaaf','Adh-Dhaariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahmaan','Al-Waaqia','Al-Hadid','Al-Mujaadila','Al-Hashr','Al-Mumtahana','As-Saff','Al-Jumu\'a','Al-Munaafiqoon','At-Taghaabun','At-Talaaq','At-Tahrim','Al-Mulk','Al-Qalam','Al-Haaqqa','Al-Ma\'aarij','Nooh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyaama','Al-Insaan','Al-Mursalaat','An-Naba','An-Naazi\'aat','Abasa','At-Takwir','Al-Infitaar','Al-Mutaffifin','Al-Inshiqaaq','Al-Burooj','At-Taariq','Al-A\'laa','Al-Ghaashiya','Al-Fajr','Al-Balad','Ash-Shams','Al-Lail','Ad-Dhuhaa','Ash-Sharh','At-Tin','Al-Alaq','Al-Qadr','Al-Bayyina','Az-Zalzala','Al-Aadiyaat','Al-Qaari\'a','At-Takaathur','Al-Asr','Al-Humaza','Al-Fil','Quraish','Al-Maa\'un','Al-Kawthar','Al-Kaafiroon','An-Nasr','Al-Masad','Al-Ikhlaas','Al-Falaq','An-Naas'];
const surahName = (n) => SURAH_NAMES[n - 1] || `Surah ${n}`;

async function embedQuery(text) {
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-m3`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text] }),
    },
  );
  if (!res.ok) throw new Error(`Embedding failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.result.data[0];
}

async function rpc(fn, body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Retrieval (${fn}) failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Famous SHORT surahs (<=7 ayahs) people ask about BY NAME — similarity search misses
// these because it matches verse content, not the surah's nickname.
const SURAH_ALIASES = {
  fatiha: 1, 'al-fatiha': 1, asr: 103, 'al-asr': 103, fil: 105, 'al-fil': 105,
  quraysh: 106, maun: 107, 'al-maun': 107, kawthar: 108, 'al-kawthar': 108,
  kafirun: 109, 'al-kafirun': 109, nasr: 110, 'an-nasr': 110, masad: 111, lahab: 111,
  ikhlas: 112, 'al-ikhlas': 112, falaq: 113, 'al-falaq': 113, nas: 114, 'an-nas': 114,
};

// Pull out verse refs the user names explicitly (a number like 2:255, "Ayat al-Kursi",
// or a famous short surah by name) so we can guarantee those verses are citable.
function extraRefs(question) {
  const refs = [];
  const q = question.toLowerCase();
  let m;
  const re = /\b(\d{1,3}):(\d{1,3})\b/g;
  while ((m = re.exec(question))) refs.push({ surah: +m[1], ayah: +m[2] });
  if (/ayat\s*al[-\s]?kursi|ayatul\s*kursi|throne verse/.test(q)) refs.push({ surah: 2, ayah: 255 });
  // Greetings/small talk → offer one warm, uplifting verse (hearts find rest in remembrance).
  if (/^\s*(hi|hey+|hello|yo|howdy|salam|salaam|asalam|assalam|as[-\s]?salaam?u?\s*alaiku?m|good\s*(morning|afternoon|evening)|peace be upon you)\b/i.test(q)) {
    refs.push({ surah: 13, ayah: 28 });
  }
  for (const [name, num] of Object.entries(SURAH_ALIASES)) {
    if (new RegExp(`\\b${name}\\b`).test(q)) {
      refs.push({ surah: num });
      break;
    }
  }
  return refs;
}

async function fetchVerses(refs) {
  if (!refs.length) return [];
  const ors = refs.map((r) => (r.ayah ? `id.eq.${r.surah * 1000 + r.ayah}` : `surah.eq.${r.surah}`));
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/verses?or=(${ors.join(',')})&select=id,surah,ayah,arabic,translation&order=id&limit=10`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) return [];
  return res.json();
}

// Keyword-only retrieval over the generated FTS tsvector columns (PostgREST websearch).
// Used as a graceful fallback when query embedding is unavailable (e.g. Cloudflare's daily
// Neuron quota is spent) — the chat keeps working on keywords instead of hard-failing.
// Pull the meaningful content words out of a question and OR them together — a natural
// question ("what does the Quran say about patience?") otherwise ANDs every word and
// matches nothing. Stopwords + question framing are dropped.
const FTS_STOP = new Set(
  ('what whats does do did is are was were the a an to of in on at for and or about how why when ' +
    'where which who whom this that these those quran quranic say says said tell me i my we our you ' +
    'your he she it its they them their can could would should will shall please am be been being ' +
    'have has had with from as by if then than so but not no yes there here just like more most ' +
    'mean means meaning explain').split(' '),
);
function ftsQuery(q) {
  const ks = q
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !FTS_STOP.has(w));
  return ks.length ? ks.join(' or ') : q;
}
async function ftsSearch(table, columns, q, count) {
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/${table}` +
    `?fts=wfts(english).${encodeURIComponent(ftsQuery(q))}&select=${columns}&limit=${count}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}
const ftsVerses = (q, count = 8) => ftsSearch('verses', 'id,surah,ayah,arabic,translation', q, count);
const ftsTafsir = (q, count = 4) => ftsSearch('tafsir', 'id,surah,ayah,source,text', q, count);

// From the finished answer + retrieved context, build the verse/tafsir cards: only verses the
// answer actually cited (∩ retrieved), named verses always first, tafsir only when the answer
// leaned on Ibn Kathir. Citations need the whole answer, so in streaming mode this runs after the
// token stream completes.
function buildCards(answer, verses, named, tafsir) {
  const cited = new Set();
  const refRe = /(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;
  let m;
  while ((m = refRe.exec(answer))) {
    const s = +m[1];
    const a1 = +m[2];
    const a2 = m[3] ? +m[3] : a1;
    for (let a = a1; a <= a2; a++) cited.add(`${s}:${a}`);
  }
  const toCard = (v) => ({ surah: v.surah, ayah: v.ayah, arabic: v.arabic, translation: v.translation });
  const citedCards = verses.filter((v) => cited.has(`${v.surah}:${v.ayah}`)).map(toCard);
  const seenCard = new Set();
  const verseCards = [];
  for (const c of [...named.map(toCard), ...citedCards]) {
    const k = `${c.surah}:${c.ayah}`;
    if (seenCard.has(k)) continue;
    seenCard.add(k);
    verseCards.push(c);
  }
  const usedTafsir = /ibn\s*kathir/i.test(answer);
  const tafsirCards = usedTafsir
    ? tafsir
        .filter((t) => (t.text || '').trim().length >= 200)
        .slice(0, 3)
        .map((t) => ({ source: 'Ibn Kathir', surah: t.surah, ayah: t.ayah, snippet: t.text.trim() }))
    : [];
  return { verseCards, tafsirCards };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { question, history, voice, stream } = req.body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const q = question.trim().slice(0, 500);

    // Prior conversation turns (for follow-ups). Keep it lean + sanitized.
    const priorTurns = (Array.isArray(history) ? history : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));

    // 1) Embed the question, then hybrid-retrieve verses + tafsir. If embedding is
    //    unavailable (e.g. Cloudflare's daily quota is spent), fall back to keyword (FTS)
    //    search so the chat degrades gracefully instead of failing.
    const namedP = fetchVerses(extraRefs(q));
    let embedding = null;
    try {
      embedding = await embedQuery(q);
    } catch (e) {
      console.error('Embedding unavailable, using keyword fallback:', (e && e.message) || e);
    }
    let retrieved = [];
    let tafsir = [];
    if (embedding) {
      const vecStr = `[${embedding.join(',')}]`;
      [retrieved, tafsir] = await Promise.all([
        rpc('match_verses', { query_embedding: vecStr, query_text: q, match_count: 8 }),
        rpc('match_tafsir', { query_embedding: vecStr, query_text: q, match_count: 4 }),
      ]);
    } else {
      [retrieved, tafsir] = await Promise.all([ftsVerses(q, 8), ftsTafsir(q, 4)]);
    }
    const named = await namedP;

    // Optional play-button video card (retrieval-only, from our vetted Watch set; never in voice
    // mode). Fully isolated — wrapped so any failure just means "no card", never touching the
    // verse/tafsir retrieval or the answer below.
    let video = null;
    if (!voice) {
      try {
        video = matchVideo(embedding, q);
      } catch {
        video = null;
      }
    }

    // Named/numbered verses first (guaranteed citable), then similarity matches; dedup.
    const seenIds = new Set();
    const verses = [];
    for (const v of [...named, ...retrieved]) {
      if (seenIds.has(v.id)) continue;
      seenIds.add(v.id);
      verses.push(v);
    }

    // 2) Build grounded context for the model. No early-out when nothing is retrieved —
    // greetings, casual chat ("hi"), and practical questions should still get a warm,
    // teacher-like reply (the system prompt says answer naturally; don't force/invent verses).
    const verseBlock = verses.length
      ? verses.map((v) => `[${surahName(v.surah)} ${v.surah}:${v.ayah}] ${v.translation}`).join('\n')
      : '(no specific verses retrieved — reply warmly and conversationally, like a kind teacher; do NOT cite or invent any verse)';
    const tafsirBlock = tafsir
      .map((t) => `(Ibn Kathir on ${t.surah}:${t.ayah}) ${t.text.slice(0, 700)}`)
      .join('\n\n');
    const userMsg =
      `The user's message: "${q}"\n\n` +
      `Context the app retrieved for this message (the user did NOT provide this):\n\n` +
      `RETRIEVED VERSES (cite by reference; the app renders the real text):\n${verseBlock}\n\n` +
      `RETRIEVED TAFSIR (classical commentary — attribute, don't treat as scripture):\n${tafsirBlock}\n\n` +
      `Answer their message directly and warmly, weaving in only the most relevant verses. Keep it concise and connected to what they actually asked. Use any earlier conversation for context.` +
      (voice
        ? `\n\nIMPORTANT — this is a SPOKEN voice conversation, read aloud by a text-to-speech voice. Reply in 1–3 short, natural sentences as if talking to the person. Be warm and direct, get to the point quickly. NO markdown, NO bullet lists, NO headings, NO emoji. When you mention a verse, follow this pattern EXACTLY — both parts are required every time:
1) say the surah name and ayah in spoken words ("in Surah <Name>, verse <N>"), then
2) after the meaning, the digits-only reference in parentheses "(<surah>:<ayah>)".
Full example: "In Surah Hud, verse 11, the Qur'an promises forgiveness and a great reward for those who are patient (11:11)."
The spoken "Surah <Name>, verse <N>" makes it sound natural when read aloud; the "(11:11)" lets the app link the card — never put the name or the word "verse" inside the parentheses, and never give just one without the other. Only reference verses from the retrieved list above; do not cite from memory. Keep the whole reply brief.`
        : '');

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...priorTurns,
      { role: 'user', content: userMsg },
    ];

    // Streaming path: proxy Groq tokens as NDJSON, then a final event carrying the verse/tafsir
    // cards (which need the whole answer to validate citations).
    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      let answer = '';
      try {
        answer = await streamGroq(
          { model: GROQ_MODEL, messages, maxTokens: voice ? 260 : 800, reasoningEffort: 'low' },
          (delta) => res.write(JSON.stringify({ t: delta }) + '\n'),
        );
      } catch (e) {
        res.write(JSON.stringify({ error: String((e && e.message) || e) }) + '\n');
        return res.end();
      }
      const { verseCards, tafsirCards } = buildCards(answer, verses, named, tafsir);
      res.write(
        JSON.stringify({
          done: true,
          verses: verseCards,
          tafsir: tafsirCards,
          video,
          disclaimer: STUDY_AID_DISCLAIMER,
        }) + '\n',
      );
      return res.end();
    }

    // 3) Groq, grounded (non-streaming — used by voice mode, which needs the whole text for TTS).
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: voice ? 260 : 800, // voice replies are short & spoken → fewer tokens, faster to generate and to speak
        reasoning_effort: 'low', // gpt-oss is a reasoning model — keep hidden reasoning small so it's fast and the visible answer isn't truncated
      }),
    });
    if (!groqRes.ok) {
      return res.status(502).json({ error: 'LLM failed', detail: (await groqRes.text()).slice(0, 200) });
    }
    const groqJson = await groqRes.json();
    const answer = (groqJson.choices?.[0]?.message?.content || '').trim();

    const { verseCards, tafsirCards } = buildCards(answer, verses, named, tafsir);
    return res.status(200).json({
      answer,
      verses: verseCards,
      tafsir: tafsirCards,
      video,
      disclaimer: STUDY_AID_DISCLAIMER,
    });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};

const STUDY_AID_DISCLAIMER =
  "AI study aid grounded in the Qur'an and classical tafsir — not a fatwa or a substitute for a qualified scholar.";
