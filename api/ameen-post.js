// Vercel serverless - the ONLY way an intention is created on the community "Ameen wall". Clients
// cannot insert into `intentions` directly (RLS forbids it), so this server-side gate - length cap +
// link/profanity block + a Groq safety classifier (fail-closed) + crisis check + per-user rate limit
// - can never be bypassed. Inserts via the service role once it passes. No new secrets (reuses the
// chat feature's GROQ + SUPABASE env).
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const MAX_BODY = 140;
const MAX_NAME = 24;
const RATE_WINDOW_MS = 90 * 1000; // at most one post per 90s per user

// Only verses from our hand-vetted COMFORTING set may be attached (mobile/lib/intention-verses.ts).
// The client only ever sends these; this is the server-side backstop. Keep in sync if that index changes.
const ALLOWED_REFS = new Set([
  '26:80', '21:83', '17:24', '46:15', '2:156', '2:157', '13:28', '94:5', '65:3', '2:153', '1:6', '18:10',
  '2:186', '39:53', '66:8', '11:6', '41:30', '3:173', '30:21', '25:74', '3:38', '20:25', '20:26', '94:6',
  '59:10', '49:10', '2:152', '16:18', '2:286',
]);

const URL_RE = /(https?:\/\/|www\.|\b[\w-]+\.(?:com|net|org|io|co|app|ru|xyz|info|link|me)\b)/i;
const CRISIS_RE =
  /suicid|kill (?:myself|me)|end (?:my life|it all)|want to die|self.?harm|hurt myself|harming myself|no (?:point|reason) (?:in|to) (?:living|life)|kill her|kill him/i;

// Validate the caller's Supabase session and return the user (id), or null.
async function getUser(token) {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      // apikey just identifies the project to the gateway; the Bearer (user JWT) identifies the user.
      // Use the service-role key since it's already in Vercel env (the anon key isn't).
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

// Binary safety classifier. Fail-CLOSED: any error or non-APPROVE -> not posted.
async function approves(text) {
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 8,
        messages: [
          {
            role: 'system',
            content:
              'You moderate short prayer intentions (duas) for a Muslim community wall. APPROVE sincere prayer requests, intentions, or words of hope. REJECT anything containing hate, harassment, insults, profanity, sexual content, violence or threats, advertising, spam, links, phone numbers or emails, political agitation, sectarian attacks, impersonation, or that is gibberish or clearly not a prayer/intention. Reply with exactly one word: APPROVE or REJECT.',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) return false;
    const j = await res.json();
    const ans = (j.choices?.[0]?.message?.content || '').trim();
    return /^\s*approve/i.test(ans);
  } catch {
    return false;
  }
}

async function postedRecently(userId) {
  try {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/intentions?user_id=eq.${userId}&created_at=gte.${since}&select=id`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) return false;
    return (await res.json()).length > 0;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign-in required.' });
    const user = await getUser(token);
    if (!user) return res.status(401).json({ error: 'Your session expired - reopen the wall.' });

    const { body, category, authorName } = req.body || {};
    const text = String(body || '').trim().replace(/\s+/g, ' ');
    if (!text) return res.status(400).json({ error: 'Write an intention first.' });
    if (text.length > MAX_BODY) return res.status(400).json({ error: `Please keep it under ${MAX_BODY} characters.` });

    // Crisis: never post publicly - meet them with care + a helpline instead (duty of care).
    if (CRISIS_RE.test(text)) {
      return res.status(200).json({
        blocked: 'crisis',
        message:
          "It sounds like you're carrying something really heavy. Please reach out right now - to someone you trust, or your local emergency services or a crisis helpline. You matter, and you don't have to face this alone.",
      });
    }
    if (URL_RE.test(text)) return res.status(422).json({ error: 'Links arent allowed here.' });

    if (!(await approves(text))) {
      return res
        .status(422)
        .json({ error: "This didn't pass our gentle check. Try rephrasing it as a sincere prayer or intention." });
    }

    if (await postedRecently(user.id)) {
      return res.status(429).json({ error: "You're posting quickly - take a breath and try again in a moment." });
    }

    const name = (String(authorName || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME)) || 'Anonymous';
    const cat = category ? String(category).slice(0, 40) : null;
    // Attached verse(s) must be from the vetted comforting set; cap at 2.
    const refs = Array.isArray(req.body?.verseRefs)
      ? [...new Set(req.body.verseRefs.map(String))].filter((r) => ALLOWED_REFS.has(r)).slice(0, 2)
      : [];
    const record = { user_id: user.id, author_name: name, body: text, category: cat };
    if (refs.length) record.verse_refs = refs;

    const ins = await fetch(`${process.env.SUPABASE_URL}/rest/v1/intentions`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
    });
    if (!ins.ok) {
      return res.status(502).json({ error: 'Could not post right now.', detail: (await ins.text()).slice(0, 200) });
    }
    const [row] = await ins.json();
    return res.status(200).json({ intention: row });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
