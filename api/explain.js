// Vercel serverless — grounded explanation of a SINGLE ayah for the reader's "Explain" action.
// Unlike /api/chat this needs no embeddings: we know the exact verse, so we look its Ibn Kathir
// commentary up DIRECTLY by surah:ayah and have the model explain ONLY from that + the verse.
//
// Body (JSON): { surah, ayah, name?, level?('simple'|'standard'), tone?('explore'|'default') }
// Response:    { explanation, surah, ayah, hasTafsir, disclaimer }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// A fast instruct model (no hidden reasoning phase) — explaining a verse from its tafsir is a
// constrained, grounded task, so this returns much quicker than a reasoning model while staying
// accurate. (The main chat keeps gpt-oss-120b for trickier open-ended questions.)
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const { streamGroq } = require('./_groq');

async function sbGet(path) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function getVerse(surah, ayah) {
  const id = surah * 1000 + ayah;
  const rows = await sbGet(`verses?id=eq.${id}&select=surah,ayah,arabic,translation&limit=1`);
  return rows[0] || null;
}

async function getTafsir(surah, ayah) {
  // Exact ayah first; Ibn Kathir often comments on a GROUP of ayahs, so if there's no chunk keyed
  // exactly here, fall back to the nearest preceding commentary block in the same surah.
  let rows = await sbGet(
    `tafsir?surah=eq.${surah}&ayah=eq.${ayah}&select=text,ayah&order=id&limit=4`,
  );
  if (!rows.length) {
    rows = await sbGet(
      `tafsir?surah=eq.${surah}&ayah=lte.${ayah}&select=text,ayah&order=ayah.desc&limit=3`,
    );
  }
  return rows;
}

const SYSTEM = `You are a warm, careful Qur'an study companion explaining a SINGLE verse to someone reading it in an app. You are a study aid, not a mufti.

GROUND your explanation ONLY in the verse translation and the Ibn Kathir commentary excerpts provided. Do NOT invent historical events, reasons for revelation, names, numbers, or meanings that aren't supported by them. If the commentary is thin or absent, explain the plain sense of the translation and say detailed commentary isn't available for this verse — never fill the gap with invented detail.

Mainstream Sunni understanding. If the commentary notes that scholars differ, you may mention it briefly. NEVER issue a binding ruling (no halal/haram verdicts, no "you must / must not") — for any such matter, gently defer to a qualified scholar. Never write Arabic text yourself.

FORMAT — plain short paragraphs, no headings, no markdown, no emoji:
1) What it means — the plain sense of the verse, in clear words.
2) Context or insight — background or why, ONLY if the commentary provides it.
3) A takeaway — one gentle reflection to carry away.
Keep it to 2–4 short paragraphs. Warm, clear, never preachy.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { surah, ayah, name, level, tone, stream } = req.body || {};
    const s = parseInt(surah, 10);
    const a = parseInt(ayah, 10);
    if (!s || !a || s < 1 || s > 114 || a < 1) {
      return res.status(400).json({ error: 'valid surah & ayah required' });
    }

    // verse + tafsir don't depend on each other → fetch in parallel
    const [verse, tafsir] = await Promise.all([getVerse(s, a), getTafsir(s, a)]);
    if (!verse) return res.status(404).json({ error: 'verse not found' });
    const hasTafsir = tafsir.length > 0;

    const label = name ? `Surah ${name} ${s}:${a}` : `Surah ${s}, verse ${a} (${s}:${a})`;
    const tafsirBlock = hasTafsir
      ? tafsir
          .map((t) => (t.text || '').trim().slice(0, 900))
          .filter(Boolean)
          .join('\n\n')
      : '(no commentary available for this verse)';

    const audience =
      tone === 'explore'
        ? 'someone exploring Islam who may not share its beliefs — explain, do not exhort'
        : 'a Muslim reader';
    const depth =
      level === 'simple'
        ? 'Use very plain language and define any unfamiliar terms. Keep it short.'
        : 'A little more depth is fine where the commentary supports it.';

    const userMsg =
      `Verse — ${label}: "${verse.translation}"\n\n` +
      `Ibn Kathir commentary excerpts (may be partial):\n${tafsirBlock}\n\n` +
      `Explain this verse for ${audience}. ${depth}`;

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMsg },
    ];
    const DISCLAIMER =
      "AI study aid grounded in the Qur'an and Ibn Kathir's tafsir — not a fatwa or a substitute for a qualified scholar.";

    // Streaming path: proxy tokens as NDJSON, then a final event with the metadata.
    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      let explanation = '';
      try {
        explanation = await streamGroq({ model: GROQ_MODEL, messages, maxTokens: 500 }, (delta) =>
          res.write(JSON.stringify({ t: delta }) + '\n'),
        );
      } catch (e) {
        res.write(JSON.stringify({ error: String((e && e.message) || e) }) + '\n');
        return res.end();
      }
      res.write(
        JSON.stringify({ done: true, surah: s, ayah: a, hasTafsir, disclaimer: DISCLAIMER }) + '\n',
      );
      return res.end();
    }

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
        max_tokens: 500,
      }),
    });
    if (!groqRes.ok) {
      return res.status(502).json({ error: 'LLM failed', detail: (await groqRes.text()).slice(0, 200) });
    }
    const groqJson = await groqRes.json();
    const explanation = (groqJson.choices?.[0]?.message?.content || '').trim();
    if (!explanation) return res.status(502).json({ error: 'empty explanation' });

    return res.status(200).json({ explanation, surah: s, ayah: a, hasTafsir, disclaimer: DISCLAIMER });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
