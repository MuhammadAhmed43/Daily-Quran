// Vercel serverless function -- the image feature for the Ask chat. An image is NEVER a source of
// scripture; a VISION model only describes/moderates/reads it, and that feeds the SAME grounded
// pipeline as chat.js (api/_rag.js): verses come from the verified DB and citations are validated.
//
// Three modes, routed by what the vision step sees (so relevance is gated by scene, not by an
// unreliable similarity score):
//   A) Q&A / fact-check -- the photo is text/a claim/a discussion, OR the user asked a question.
//      Reads the text and answers grounded in real verses; gently corrects fabricated "Qur'an quotes";
//      DEFERS on rulings ("scholars differ").
//   B) Reflection -- a nature/creation scene with no question. Creation verses only, never forced.
//   C) Gentle -- anything else (object/person/food/place). A warm, VERSE-FREE note.
// The prose is sanitized so no verse the model recalled from memory (not retrieved) can appear.
// The photo is processed in-request and NEVER stored.
//
// Body (JSON): { image: dataURL(jpeg base64), question?, history?, stream?, debug?, minScore? }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Groq multimodal; CF Llama-3.2-Vision is the documented fallback
const TEXT_MODEL = 'openai/gpt-oss-120b'; // same grounded answerer as chat.js

const { CRISIS_RE, surahName, retrieveContext, buildCards, sanitizeRefs, recognizeVerse, fetchVerses, fetchTafsir, STUDY_AID_DISCLAIMER } = require('./_rag');
const { streamGroq } = require('./_groq');

const MAX_IMAGE_CHARS = 6_000_000; // ~4MB of base64 -- Groq's base64 image ceiling; the client compresses well under this
const REFLECT_MIN_SCORE = 0.45; // weak backstop for the reflection path; the scene gate is the real control
const QA_MIN_SCORE = 0.57; // QA floor: drop verses unrelated to the claim so the model can't enumerate/card them; explicitly-named verses (e.g. a "2:255" in the claim) bypass it
const RATE_MSG = "I'm getting a lot of requests right now -- please try again in a few seconds.";
// Duty of care: if a photo's text/caption or the question signals distress or self-harm, wellbeing
// comes before any reflection or scripture (mirrors the chat + ameen-wall crisis handling).
const CRISIS_MSG =
  "It sounds like you may be carrying something really heavy right now, and I'm glad you reached out. Please talk to someone who can be there with you -- in the US you can call or text 988 (the Suicide and Crisis Lifeline), anytime, day or night; elsewhere, your local emergency number or a crisis line can help. You matter, and you deserve real support. I'm here too, but please reach out to them first.";

// ---- vision: describe + moderate + classify + read text. STRICT JSON, no interpretation. ----
const VISION_SYSTEM = `You are a careful visual describer for a Qur'an study app. Look at the image and reply with STRICT JSON ONLY (no prose, no markdown), matching exactly:
{
  "appropriate": boolean,
  "reason": string,
  "scene": string,
  "description": string,
  "themes": string[],
  "text": string,
  "arabic_text": string
}
Field rules:
- "appropriate": set false ONLY for genuinely harmful VISUAL content -- sexual or nude imagery, graphic violence or gore, or content made to demean or incite hatred against a group. A photo of TEXT is appropriate even if the text makes a religious claim that is false, dubious, manipulative, or a chain-message hoax -- examining and gently correcting such claims is exactly our purpose, so set true for those. When unsure, set true.
- "reason": if not appropriate, one short gentle clause; else "".
- "scene": the single best category -- one of: "nature" (the natural world: sky, sea, landscape, plants, animals, weather, celestial), "place" (building, architecture, room, street), "people" (a person or people are the main subject), "object" (a thing, product, device), "food" (food or drink), "text" (the main content is readable text: a screenshot, post, message, sign, document, infographic, a claim or a discussion), "scripture" (appears to be Qur'anic Arabic: a mushaf page, an ayah, calligraphy), or "other".
- "description": 1-2 plain sentences naming the main subject, scene, and mood. Generic only.
- "themes": a few abstract themes for finding relevant verses (e.g. "creation","the sea","mountains","gratitude"). [] if none.
- "text": ALL readable text in the image, transcribed faithfully (posts, captions, claims, signs, document text); "" if none.
- "arabic_text": any Arabic that appears to be Qur'an or scripture, transcribed as best you can; else "".
Hard rules: Do NOT name or identify specific real people. Do NOT guess anyone's religion. Do NOT interpret meaning or issue any ruling. Do NOT describe a depiction of any prophet or sacred figure -- if the image appears to depict a prophet or sacred figure, set "appropriate": false with a gentle reason. Describe only what is plainly visible.`;

// ---- mode B: creation reflection ----
const REFLECT_SYSTEM = `You are a warm, humble Qur'an study companion. The person shared a PHOTO of a scene from the natural world; your app described it and retrieved candidate VERSES and TAFSIR from a verified database (the user did NOT provide these). Help them reflect on this scene of creation through the lens of the Qur'an. You are a study aid, not a mufti.

- Gently acknowledge what is in the image, then offer a short, heartfelt reflection on Allah's signs in creation, weaving in only the 1-2 verses that GENUINELY fit in meaning -- never on a shared word alone, never a verse of warning, punishment, or the Day of Judgment repurposed as comfort, and never a verse describing Paradise or its people (for example "rubies and coral") borrowed to describe an earthly scene's colors. The meaning must truly match, not just the imagery. State each verse's meaning faithfully; if unsure what a verse means, do not use it.
- If none of the retrieved verses truly fit, do NOT cite any -- reflect warmly without a verse. That is perfectly fine.
- Cite ONLY verses from the retrieved list, as surah:ayah, e.g. (2:164). Never quote a verse from memory and never write Arabic Qur'anic text yourself -- the app renders the real text.
- WELLBEING FIRST: if anything suggests serious distress or self-harm, gently urge reaching out to someone who cares or a helpline before anything else.

FORMATTING: warm plain prose, short paragraphs, mobile chat bubble. No markdown headings/tables/code. Two or three short paragraphs at most. No self-disclaimer; the app adds one.`;

// ---- mode A: grounded Q&A / fact-check ----
const QA_SYSTEM = `You are a warm, knowledgeable Qur'an study companion. The person shared a PHOTO containing text, a claim, a discussion, or a question, and wants to understand it in light of the Qur'an -- often "is this accurate?". Your app automatically looked up and retrieved the VERSES and TAFSIR below; the user did NOT provide, list, or share them, so never say "the verses you listed/provided." You are a study aid, not a mufti.

- Answer directly, warmly, and honestly. FACT-CHECK GENTLY: if the image misattributes or fabricates a "Qur'an quote," or claims something the Qur'an does not say, say so kindly and show what the verified text actually says. If a claim is accurate, affirm it simply. Never be harsh or triumphant.
- CITE SPARINGLY AND ONLY IN SUPPORT: write a surah:ayah reference (e.g. 2:255) ONLY when you are actively using that verse to support a point you are making. Do NOT list or enumerate the retrieved verse numbers to dismiss them as irrelevant -- if the retrieved verses do not relate to the claim, just say in general words that the Qur'an does not address it, WITHOUT writing any verse numbers. Use tafsir sparingly and attribute it ("Ibn Kathir explains...").
- NEVER mention, suggest, or recommend a verse that is not in the retrieved list -- not even as "further reading." Never quote a verse from memory and never write Arabic Qur'anic text yourself. When showing what a verse actually says, describe its meaning in your own words rather than quoting a translation verbatim or in a blockquote -- the verse card displays the exact, verified text. Write plain prose; do not use blockquotes or headings.
- RULINGS and CONTESTED matters (halal/haram, whether an act is obligatory or forbidden, sectarian disputes, "is this group right"): do NOT issue a verdict. Give brief neutral context, note that scholars differ, and point to a qualified scholar. Deferring is the correct answer.
- Stay strictly neutral and NON-POLEMICAL; never attack or endorse any sect, group, or person, and do not identify individuals in the image.
- If unsure of a factual detail, keep it general rather than stating it confidently.

FORMATTING: warm plain prose, short paragraphs, mobile chat bubble. No markdown headings/tables/code. Concise. No self-disclaimer; the app adds one.`;

// ---- mode C: gentle, verse-free ----
const GENTLE_SYSTEM = `You are a warm Qur'an study companion. The person shared a PHOTO that isn't something the Qur'an speaks to directly (an everyday object, a person, food, an indoor scene, and the like). Briefly and warmly acknowledge what is in it, then offer a short, sincere thought about remembering Allah, gratitude, or good character -- WITHOUT quoting or citing any specific Qur'an verse and WITHOUT writing any surah:ayah reference. Two or three warm sentences. You may gently invite them to ask a question, or to share a scene from nature for a verse-based reflection. No markdown. No self-disclaimer.`;

// ---- mode R: verse recognition (we identified the verse; the model only confirms + explains) ----
const RECOGNIZE_SYSTEM = `The person photographed Qur'anic Arabic and the app has IDENTIFIED the exact verse (given below with its verified meaning and any tafsir). Warmly tell them which surah (by name) and which ayah it is, then explain its meaning in one or two short sentences, grounded ONLY in the given verse and tafsir. Do NOT write the Arabic yourself and do NOT quote the translation verbatim -- the verse card shows the exact text. If tafsir is given you may add one brief insight, attributed ("Ibn Kathir explains..."). Keep it short, warm, and in plain prose. No markdown, no self-disclaimer.`;

function isRateLimit(e) {
  return /\b429\b|rate.?limit/i.test(String((e && e.message) || e || ''));
}

async function describeImage(image, question) {
  const userText =
    question && question.trim()
      ? `The person is looking at this image and asked: "${question.trim().slice(0, 300)}". Classify and describe it per the schema, and transcribe any text.`
      : 'Classify and describe this image per the schema, and transcribe any text.';
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: VISION_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Vision failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  let parsed = {};
  try {
    parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');
  } catch {
    parsed = {};
  }
  return {
    appropriate: parsed.appropriate !== false,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    scene: typeof parsed.scene === 'string' ? parsed.scene.toLowerCase().trim() : 'other',
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    themes: Array.isArray(parsed.themes) ? parsed.themes.filter((t) => typeof t === 'string').slice(0, 8) : [],
    text: typeof parsed.text === 'string' ? parsed.text.trim() : '',
    arabicText: typeof parsed.arabic_text === 'string' ? parsed.arabic_text.trim() : '',
  };
}

async function groqText(messages, maxTokens) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: TEXT_MODEL, messages, temperature: 0.3, max_tokens: maxTokens, reasoning_effort: 'low' }),
  });
  if (!res.ok) return { ok: false, status: res.status, detail: (await res.text()).slice(0, 200) };
  const j = await res.json();
  return { ok: true, answer: (j.choices?.[0]?.message?.content || '').trim() };
}

// Emit a scripture-free reply (decline / unreadable / rate-limit) in whichever shape the client asked.
function respondPlain(res, stream, message) {
  if (stream) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.write(JSON.stringify({ t: message }) + '\n');
    res.write(JSON.stringify({ done: true, answer: message, verses: [], tafsir: [], disclaimer: STUDY_AID_DISCLAIMER }) + '\n');
    return res.end();
  }
  return res.status(200).json({ answer: message, verses: [], tafsir: [], disclaimer: STUDY_AID_DISCLAIMER });
}

// Run the answer step for any mode: call the text model (stream or not), sanitize from-memory refs,
// validate cards, respond. verses/tafsir/named are [] for the gentle (verse-free) mode.
async function runAnswer(res, opts) {
  const { stream, system, priorTurns, userMsg, verses, tafsir, named, caption, mode, maxTokens, debugInfo } = opts;
  const messages = [{ role: 'system', content: system }, ...priorTurns, { role: 'user', content: userMsg }];
  // Allowed citations = retrieved verses AND the verses the retrieved tafsir is about (so "Ibn Kathir
  // on 7:204" survives the sanitizer); buildCards still independently gates the verse cards.
  const allowed = new Set([...verses, ...tafsir].map((v) => `${v.surah}:${v.ayah}`));

  if (stream) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    let answer = '';
    try {
      answer = await streamGroq(
        { model: TEXT_MODEL, messages, maxTokens, reasoningEffort: 'low' },
        (delta) => res.write(JSON.stringify({ t: delta }) + '\n'),
      );
    } catch (e) {
      const friendly = isRateLimit(e) ? RATE_MSG : null;
      res.write(JSON.stringify(friendly ? { t: '\n' + friendly } : { error: String((e && e.message) || e) }) + '\n');
      res.write(JSON.stringify({ done: true, answer: friendly || '', verses: [], tafsir: [], disclaimer: STUDY_AID_DISCLAIMER }) + '\n');
      return res.end();
    }
    const clean = sanitizeRefs(answer, allowed);
    const { verseCards, tafsirCards } = buildCards(clean, verses, named, tafsir);
    res.write(
      JSON.stringify({
        done: true,
        answer: clean, // the client should finalize on this (sanitized) text
        verses: verseCards,
        tafsir: tafsirCards,
        caption,
        mode,
        disclaimer: STUDY_AID_DISCLAIMER,
        ...(debugInfo ? { debug: debugInfo } : {}),
      }) + '\n',
    );
    return res.end();
  }

  const r = await groqText(messages, maxTokens);
  if (!r.ok) {
    if (r.status === 429) return respondPlain(res, false, RATE_MSG);
    return res.status(502).json({ error: 'LLM failed', detail: r.detail });
  }
  const clean = sanitizeRefs(r.answer, allowed);
  const { verseCards, tafsirCards } = buildCards(clean, verses, named, tafsir);
  return res.status(200).json({
    answer: clean,
    verses: verseCards,
    tafsir: tafsirCards,
    caption,
    mode,
    disclaimer: STUDY_AID_DISCLAIMER,
    ...(debugInfo ? { debug: debugInfo } : {}),
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = req.body || {};
    const { image, question, history, stream } = body;
    const debug = body.debug === true;
    const minScore = typeof body.minScore === 'number' ? body.minScore : REFLECT_MIN_SCORE;
    if (!image || typeof image !== 'string' || !/^data:image\//.test(image)) {
      return res.status(400).json({ error: 'image (data URL) is required' });
    }
    if (image.length > MAX_IMAGE_CHARS) {
      return respondPlain(res, stream, 'That image is a bit large for me to look at -- a smaller or more compressed photo will work.');
    }
    const q = typeof question === 'string' ? question.trim().slice(0, 500) : '';

    // 1) Vision: describe + moderate + classify + read text.
    let vision;
    try {
      vision = await describeImage(image, q);
    } catch (e) {
      if (isRateLimit(e)) return respondPlain(res, stream, RATE_MSG);
      console.error('vision step failed:', (e && e.message) || e);
      return respondPlain(res, stream, "I couldn't read that image just now. Please try again in a moment, or tell me what you'd like to reflect on.");
    }

    if (!vision.appropriate) {
      return respondPlain(
        res,
        stream,
        "I'd rather not build a reflection around this image. If you share something else -- a scene from your day, something in nature, something that moved you -- I'm happy to reflect on it with you through the Qur'an.",
      );
    }
    if (!vision.description && !vision.text && !vision.arabicText) {
      return respondPlain(res, stream, "I couldn't make out this image clearly. A brighter or closer photo might help -- or just tell me what you'd like to reflect on.");
    }

    // WELLBEING FIRST (duty of care): if the question, or the text/caption read from the image,
    // expresses distress or self-harm, respond with support + a helpline BEFORE any reflection,
    // verse recognition, or fact-check. The QA/gentle modes have no crisis guidance, so gate here.
    if (CRISIS_RE.test(q) || CRISIS_RE.test(vision.text || '') || CRISIS_RE.test(vision.description || '')) {
      return respondPlain(res, stream, CRISIS_MSG);
    }

    const priorTurns = (Array.isArray(history) ? history : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));

    const ocrText = vision.text || '';
    const arabic = vision.arabicText || '';
    const isTextual = (vision.scene === 'text' || vision.scene === 'scripture') && (ocrText || arabic);

    // ---- MODE R: verse recognition -- a photo of Qur'anic Arabic, matched to the EXACT verse by the
    // app (never the model). Runs first whenever Arabic was read; if it can't pin the verse, we decline
    // rather than guess (so we never mis-identify scripture). ----
    if (arabic && arabic.length >= 6) {
      const match = recognizeVerse(arabic);
      if (match) {
        const verses = await fetchVerses([{ surah: match.surah, ayah: match.ayah }]);
        if (verses.length) {
          const tafsir = await fetchTafsir(match.surah, match.ayah);
          const name = surahName(match.surah);
          const tafsirBlock = tafsir.map((t) => t.text.slice(0, 700)).join('\n\n');
          const userMsg =
            `The person photographed this verse, identified as Surah ${name} (${match.surah}:${match.ayah}).\n` +
            `Verified meaning: "${verses[0].translation}"\n` +
            (tafsirBlock ? `Tafsir (Ibn Kathir): ${tafsirBlock}\n` : '') +
            (q ? `The person also asked: "${q}" -- address that briefly as well.\n` : '') +
            `Tell them which surah (by name) and ayah this is, then explain its meaning briefly.`;
          const debugInfo = debug ? { mode: 'recognize', ref: `${match.surah}:${match.ayah}`, score: match.score } : undefined;
          return await runAnswer(res, {
            stream,
            system: RECOGNIZE_SYSTEM,
            priorTurns,
            userMsg,
            verses,
            tafsir,
            named: verses,
            caption: `Qur'an ${match.surah}:${match.ayah}`,
            mode: 'recognize',
            maxTokens: 320,
            debugInfo,
          });
        }
      }
      if (vision.scene === 'scripture') {
        return respondPlain(
          res,
          stream,
          "I can see Qur'anic Arabic, but I couldn't read it clearly enough to identify the exact verse with confidence. A sharper, closer photo of a single ayah works best.",
        );
      }
    }

    // ---- MODE A: grounded Q&A / fact-check (a question, or the image is text/a claim/scripture) ----
    if (q || isTextual) {
      const retrievalQuery = [ocrText, arabic, vision.description, q].filter(Boolean).join(' ');
      const { verses, tafsir, named, scoredVerses } = await retrieveContext(retrievalQuery, { minScore: QA_MIN_SCORE });
      const verseBlock = verses.length
        ? verses.map((v) => `[${surahName(v.surah)} ${v.surah}:${v.ayah}] ${v.translation}`).join('\n')
        : '(no verses in the verified database closely match this -- if you cannot verify the claim from the verified text, say so honestly in general words; do NOT quote or name any verse from memory)';
      const tafsirBlock = tafsir.map((t) => `(Ibn Kathir on ${t.surah}:${t.ayah}) ${t.text.slice(0, 700)}`).join('\n\n');
      const userMsg =
        (vision.description ? `The photo shows: ${vision.description}.\n` : '') +
        (q ? `Their question: "${q}"\n\n` : 'They want to understand this in light of the Qur\'an, especially whether it is accurate.\n\n') +
        (ocrText ? `TEXT IN THE IMAGE:\n"${ocrText.slice(0, 2000)}"\n\n` : '') +
        (arabic ? `ARABIC IN THE IMAGE (may be Qur'an): "${arabic.slice(0, 500)}"\n\n` : '') +
        `RETRIEVED VERSES -- looked up automatically by the app; the person did NOT list or provide these (cite by reference only when you actively use one; the app renders the real text):\n${verseBlock}\n\n` +
        `RETRIEVED TAFSIR (classical commentary -- attribute, don't treat as scripture):\n${tafsirBlock}\n\n` +
        `Answer grounded in these verses. If the image misattributes or fabricates a Qur'an quote, gently correct it from the verified text. For rulings or contested matters, do not give a verdict -- note that scholars differ and point to a scholar.`;
      const debugInfo = debug
        ? { mode: 'qa', minScore: QA_MIN_SCORE, query: retrievalQuery.slice(0, 300), scored: (scoredVerses || []).map((v) => ({ ref: `${v.surah}:${v.ayah}`, score: typeof v.score === 'number' ? Number(v.score.toFixed(3)) : null })) }
        : undefined;
      return await runAnswer(res, { stream, system: QA_SYSTEM, priorTurns, userMsg, verses, tafsir, named, caption: vision.description, mode: 'qa', maxTokens: 700, debugInfo });
    }

    // ---- MODE B: creation reflection (nature scene, no question) ----
    if (vision.scene === 'nature') {
      const query = [vision.description, vision.themes.join(', ')].filter(Boolean).join('. ');
      const { verses, tafsir, named, scoredVerses } = await retrieveContext(query, { minScore });
      const verseBlock = verses.length
        ? verses.map((v) => `[${surahName(v.surah)} ${v.surah}:${v.ayah}] ${v.translation}`).join('\n')
        : "(no clearly-fitting verses -- reflect warmly on this scene of creation WITHOUT citing or inventing any verse)";
      const tafsirBlock = tafsir.map((t) => `(Ibn Kathir on ${t.surah}:${t.ayah}) ${t.text.slice(0, 700)}`).join('\n\n');
      const userMsg =
        `What the app sees in the person's photo: "${vision.description}".` +
        (vision.themes.length ? ` Themes: ${vision.themes.join(', ')}.` : '') +
        `\n\nRETRIEVED VERSES (cite by reference; the app renders the real text):\n${verseBlock}\n\n` +
        `RETRIEVED TAFSIR:\n${tafsirBlock}\n\n` +
        `Reflect warmly on this scene of creation, weaving in only genuinely fitting verses. If none truly fit, reflect gently without forcing a verse.`;
      const debugInfo = debug
        ? { mode: 'reflect', minScore, query, scored: (scoredVerses || []).map((v) => ({ ref: `${v.surah}:${v.ayah}`, score: typeof v.score === 'number' ? Number(v.score.toFixed(3)) : null })) }
        : undefined;
      return await runAnswer(res, { stream, system: REFLECT_SYSTEM, priorTurns, userMsg, verses, tafsir, named, caption: vision.description, mode: 'reflect', maxTokens: 550, debugInfo });
    }

    // ---- MODE C: gentle, verse-free (object / person / food / place / other) ----
    const gentleMsg = `The person shared a photo that shows: "${vision.description}". It isn't something the Qur'an speaks to directly. Offer a warm, brief, verse-free reflection as instructed.`;
    const debugInfo = debug ? { mode: 'gentle', scene: vision.scene } : undefined;
    return await runAnswer(res, { stream, system: GENTLE_SYSTEM, priorTurns, userMsg: gentleMsg, verses: [], tafsir: [], named: [], caption: vision.description, mode: 'gentle', maxTokens: 280, debugInfo });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
