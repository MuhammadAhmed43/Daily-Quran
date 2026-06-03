// Vercel serverless - suggest a COMFORTING ayah for an Ameen-wall intention. The model only CLASSIFIES
// the intention into one of the themes the client sends (it returns a theme id, NEVER any scripture);
// the app maps that id to its hand-vetted verse refs and renders them from the bundled Qur'an. Safe by
// construction - no verse text is ever produced here. Always returns a valid theme id (falls back to
// "comfort"). Reuses the chat feature's GROQ env.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { intention, themes } = req.body || {};
    const text = String(intention || '').trim().slice(0, 300);
    const list = Array.isArray(themes) ? themes.filter((t) => t && t.id && t.hint).slice(0, 40) : [];
    if (!text || !list.length) return res.status(200).json({ themeId: 'comfort' });

    const ids = new Set(list.map((t) => String(t.id)));
    const menu = list.map((t) => `- ${t.id}: ${t.hint}`).join('\n');
    const sys =
      'You match a short prayer intention to the single best-fitting theme from a list, so the app can show a comforting Quran verse. Reply with EXACTLY one theme id from the list and nothing else. If none clearly fits, reply "comfort".';
    const user = `Themes:\n${menu}\n\nIntention: "${text}"\n\nBest theme id:`;

    let id = 'comfort';
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: 12,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const ans = (j.choices?.[0]?.message?.content || '').trim().toLowerCase().replace(/[^a-z]/g, '');
        const exact = [...ids].find((x) => x.toLowerCase() === ans);
        const contained = [...ids].find((x) => ans.includes(x.toLowerCase()));
        if (exact) id = exact;
        else if (contained) id = contained;
      }
    } catch {}
    return res.status(200).json({ themeId: ids.has(id) ? id : 'comfort' });
  } catch {
    return res.status(200).json({ themeId: 'comfort' });
  }
};
