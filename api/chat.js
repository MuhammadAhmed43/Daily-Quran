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

const SYSTEM_PROMPT = `You are a warm, knowledgeable Qur'an study companion inside a mobile app — a thoughtful teacher, not a search engine. You answer the person's actual question, connecting to what they asked or how they feel. You are a study aid, not a mufti.

HOW THE APP WORKS: For each message, the app automatically searches a verified database and gives you RETRIEVED VERSES and TAFSIR as context. The user did NOT provide these — your app looked them up. Never say the user "provided"/"supplied"/"shared" verses; refer to them naturally ("the Qur'an says…", "a verse that speaks to this is…").

ADAPT TO THE QUESTION — important:
- PRACTICAL or PERSONAL questions (how to do something, make a plan, advice, encouragement, "I feel…"): answer naturally, warmly, and helpfully from sound general knowledge. Bring in a verse ONLY if it genuinely fits — one is plenty, or none at all. Do NOT force verses or tafsir onto practical advice.
- Questions about WHAT ISLAM / THE QUR'AN TEACHES, the MEANING of verses, or any RULING: stay grounded in the retrieved verses and tafsir, cite them, and if they don't cover it, say so honestly. NEVER invent a ruling or a claim about Islamic teaching — for a fiqh ruling, give general context and point them to a scholar.

STYLE:
- Answer the actual question first, in warm plain language.
- When you use verses, weave in the 2–3 MOST relevant ones and explain what each means for their question — not a long list (the app shows verse cards separately).
- Be concise: a few short paragraphs at most.

GROUNDING (whenever you cite scripture):
- Don't cite a verse that isn't in the retrieved set, and never write Arabic Qur'anic text yourself — refer to verses by reference, e.g. (2:155).
- Tafsir is classical COMMENTARY (Ibn Kathir) — attribute it ("Ibn Kathir explains…"), never as the Qur'an's own words or a binding ruling.
- Use earlier conversation for follow-ups. Neutral across schools and sects.

End with one short line that this is a study aid, not a substitute for a qualified scholar.`;

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { question, history } = req.body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const q = question.trim().slice(0, 500);

    // Prior conversation turns (for follow-ups). Keep it lean + sanitized.
    const priorTurns = (Array.isArray(history) ? history : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));

    // 1) Embed the question, then hybrid-retrieve verses + tafsir.
    const embedding = await embedQuery(q);
    const vecStr = `[${embedding.join(',')}]`;
    const [verses, tafsir] = await Promise.all([
      rpc('match_verses', { query_embedding: vecStr, query_text: q, match_count: 8 }),
      rpc('match_tafsir', { query_embedding: vecStr, query_text: q, match_count: 4 }),
    ]);

    if (!verses.length) {
      return res.status(200).json({
        answer: "I couldn't find verses related to that. Try rephrasing, or ask about a theme (patience, gratitude, kindness to parents…).",
        verses: [],
        tafsir: [],
        disclaimer: STUDY_AID_DISCLAIMER,
      });
    }

    // 2) Build grounded context for the model.
    const verseBlock = verses.map((v) => `[${v.surah}:${v.ayah}] ${v.translation}`).join('\n');
    const tafsirBlock = tafsir
      .map((t) => `(Ibn Kathir on ${t.surah}:${t.ayah}) ${t.text.slice(0, 700)}`)
      .join('\n\n');
    const userMsg =
      `The user's message: "${q}"\n\n` +
      `Context the app retrieved for this message (the user did NOT provide this):\n\n` +
      `RETRIEVED VERSES (cite by reference; the app renders the real text):\n${verseBlock}\n\n` +
      `RETRIEVED TAFSIR (classical commentary — attribute, don't treat as scripture):\n${tafsirBlock}\n\n` +
      `Answer their message directly and warmly, weaving in only the most relevant verses. Keep it concise and connected to what they actually asked. Use any earlier conversation for context.`;

    // 3) Groq, grounded.
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...priorTurns,
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 800,
        reasoning_effort: 'low', // gpt-oss is a reasoning model — keep hidden reasoning small so it's fast and the visible answer isn't truncated
      }),
    });
    if (!groqRes.ok) {
      return res.status(502).json({ error: 'LLM failed', detail: (await groqRes.text()).slice(0, 200) });
    }
    const groqJson = await groqRes.json();
    const answer = (groqJson.choices?.[0]?.message?.content || '').trim();

    // 4) Citation validation — which retrieved verses did the answer actually cite?
    const cited = new Set();
    // Match every surah:ayah reference (grouped, inline, or parenthesized). We only
    // keep ones present in the retrieved set, so stray matches can't invent cards.
    const refRe = /(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;
    let m;
    while ((m = refRe.exec(answer))) {
      const s = +m[1];
      const a1 = +m[2];
      const a2 = m[3] ? +m[3] : a1;
      for (let a = a1; a <= a2; a++) cited.add(`${s}:${a}`);
    }
    const toCard = (v) => ({
      surah: v.surah,
      ayah: v.ayah,
      arabic: v.arabic,
      translation: v.translation,
    });
    const citedCards = verses.filter((v) => cited.has(`${v.surah}:${v.ayah}`)).map(toCard);

    // Show the verse cards the answer actually cited (may be none for a practical
    // question). Show the Ibn Kathir block ONLY when the answer genuinely leaned on
    // the commentary (it attributes it by name) — so a practical reply that just
    // touches a verse stays clean, no forced commentary.
    const usedTafsir = /ibn\s*kathir/i.test(answer);
    const tafsirCards = usedTafsir
      ? tafsir
          .filter((t) => (t.text || '').trim().length >= 200) // drop heading-only fragments
          .slice(0, 3)
          .map((t) => ({ source: 'Ibn Kathir', surah: t.surah, ayah: t.ayah, snippet: t.text.trim() }))
      : [];

    return res.status(200).json({
      answer,
      verses: citedCards,
      tafsir: tafsirCards,
      disclaimer: STUDY_AID_DISCLAIMER,
    });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};

const STUDY_AID_DISCLAIMER =
  "AI study aid grounded in the Qur'an and classical tafsir — not a fatwa or a substitute for a qualified scholar.";
