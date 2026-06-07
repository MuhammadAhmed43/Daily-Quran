// Shared RAG core for grounded Qur'an answers (underscore prefix -> Vercel doesn't treat it as a
// route). Used by api/see.js (image reflection). It holds the SAFETY-CRITICAL pieces: retrieval from
// the verified Supabase corpus and buildCards (which renders verses from the DB and only keeps the
// ones the answer actually cited). api/chat.js currently has its own inline twins of these helpers;
// it SHOULD be migrated onto this module so buildCards has a single home -- do that, with a chat
// curl re-test, after the vision path is proven. Until then keep these byte-identical to chat.js.

// Never surface anything but support to someone in distress -- wellbeing comes before scripture.
const CRISIS_RE =
  /suicid|kill (myself|me)|end (my life|it all)|want to die|self.?harm|hurt myself|harming myself|no (point|reason) (in|to) (living|life)|hopeless/i;

// English surah names (index = surah number - 1) so the assistant can name verses, not just number them.
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
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Retrieval (${fn}) failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Famous SHORT surahs people ask about BY NAME -- similarity search misses these (it matches verse
// content, not the surah's nickname).
const SURAH_ALIASES = {
  fatiha: 1, 'al-fatiha': 1, asr: 103, 'al-asr': 103, fil: 105, 'al-fil': 105,
  quraysh: 106, maun: 107, 'al-maun': 107, kawthar: 108, 'al-kawthar': 108,
  kafirun: 109, 'al-kafirun': 109, nasr: 110, 'an-nasr': 110, masad: 111, lahab: 111,
  ikhlas: 112, 'al-ikhlas': 112, falaq: 113, 'al-falaq': 113, nas: 114, 'an-nas': 114,
};

// Pull out verse refs named explicitly (a number like 2:255, "Ayat al-Kursi", or a famous short
// surah by name) so we can guarantee those verses are citable.
function extraRefs(question) {
  const refs = [];
  const q = question.toLowerCase();
  let m;
  const re = /\b(\d{1,3}):(\d{1,3})\b/g;
  while ((m = re.exec(question))) refs.push({ surah: +m[1], ayah: +m[2] });
  if (/ayat\s*al[-\s]?kursi|ayatul\s*kursi|throne verse/.test(q)) refs.push({ surah: 2, ayah: 255 });
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

// Keyword-only retrieval over the FTS columns (PostgREST websearch) -- a graceful fallback when query
// embedding is unavailable (e.g. Cloudflare's daily Neuron quota is spent).
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

// Embed the query, hybrid-retrieve verses + tafsir; FTS fallback if embedding is unavailable. Named/
// numbered verses are guaranteed citable and placed first.
//
// opts.minScore (default 0 = off, preserving chat.js behavior) applies a RELEVANCE FLOOR for the
// image-reflection path: keep only SEMANTICALLY-strong matches. match_verses' score is max(vector
// cosine similarity, keyword ts_rank); we deliberately distrust the keyword arm here because lexical
// hits ("tablet"->"Preserved Tablet", "garden"->"Gardens of Paradise") are the exact forced-verse
// failure we must avoid. With no embedding we cannot judge semantic fit, so we keep nothing rather
// than fall back to keywords. `scoredVerses` is the pre-floor list (with scores) for calibration.
async function retrieveContext(query, opts = {}) {
  const minScore = opts.minScore || 0;
  const q = (query || '').trim().slice(0, 500);
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

  let keptVerses;
  let keptTafsir;
  if (minScore > 0) {
    if (!embedding) {
      keptVerses = [];
      keptTafsir = [];
    } else {
      keptVerses = retrieved.filter((v) => typeof v.score === 'number' && v.score >= minScore);
      keptTafsir = tafsir.filter((t) => typeof t.score === 'number' && t.score >= minScore);
    }
  } else {
    keptVerses = retrieved;
    keptTafsir = tafsir;
  }

  const named = await namedP;
  const seenIds = new Set();
  const verses = [];
  for (const v of [...named, ...keptVerses]) {
    if (seenIds.has(v.id)) continue;
    seenIds.add(v.id);
    verses.push(v);
  }
  return { verses, tafsir: keptTafsir, named, embedding, scoredVerses: retrieved };
}

// From the finished answer + retrieved context, build the verse/tafsir cards: ONLY verses the answer
// actually cited (intersect retrieved), named verses first, tafsir only when the answer leaned on Ibn
// Kathir. This is the faithfulness gate -- the model never emits scripture; we render it from the DB.
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

// Strip from the prose any surah:ayah citation NOT in `allowedRefs` (the verses we actually
// retrieved) -- both parenthesized "(16:12)" and bare "16:12". Stops the model from citing or
// recommending scripture from memory; pairs with buildCards (which gates the cards). Tidies the
// leftover spacing/punctuation. allowedRefs is a Set of "surah:ayah".
function sanitizeRefs(answer, allowedRefs) {
  if (!answer) return answer;
  const ok = (s, a) => allowedRefs.has(`${s}:${a}`);
  return answer
    // Only PARENTHESIZED refs are treated as citations (the model is told to cite as "(2:255)"); a bare
    // "3:30" in prose is almost always a time/ratio, so we leave it intact rather than mangle it.
    .replace(/\(\s*(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*\d{1,3})?\s*\)/g, (m, s, a) => (ok(s, a) ? m : '')) // (2:255)
    .replace(/\(\s*\)/g, '') // empty parens left behind
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

const STUDY_AID_DISCLAIMER =
  "AI study aid grounded in the Qur'an and classical tafsir -- not a fatwa or a substitute for a qualified scholar.";

// ---------- verse recognition (image OCR -> the exact verse, never rendered by the model) ----------
// Normalized-Arabic index, bundled by scripts/build-verse-index-ar.mjs. keep normalizeArabic()
// IDENTICAL to that script + test-recognize.mjs (code-point based; no literal Arabic / no \u ranges).
function normalizeArabic(s) {
  let out = '';
  for (const ch of s || '') {
    const c = ch.codePointAt(0);
    if ((c >= 0x610 && c <= 0x61a) || (c >= 0x64b && c <= 0x65f) || c === 0x670 || (c >= 0x6d6 && c <= 0x6ed) || c === 0x640) continue;
    let n = c;
    if (c === 0x622 || c === 0x623 || c === 0x625 || c === 0x671) n = 0x627; // alef variants + alef-wasla -> alef
    else if (c === 0x649) n = 0x64a; // alef-maqsura -> ya
    else if (c === 0x629) n = 0x647; // ta-marbuta -> ha
    else if (c === 0x624) n = 0x648; // waw-hamza -> waw
    else if (c === 0x626) n = 0x64a; // ya-hamza -> ya
    if (n >= 0x621 && n <= 0x64a) out += String.fromCharCode(n); // keep base Arabic letters
    else out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}
function arBigrams(na) {
  const ws = na.split(' ').filter(Boolean);
  const set = new Set();
  if (ws.length === 1) set.add(ws[0]);
  for (let i = 0; i < ws.length - 1; i++) set.add(ws[i] + ' ' + ws[i + 1]);
  return set;
}
let AR_INDEX = [];
try {
  AR_INDEX = require('./verse-index-ar.json').map((v) => ({ s: v.s, a: v.a, na: v.na, bg: arBigrams(v.na) }));
} catch {
  AR_INDEX = [];
}

// Identify which verse a piece of OCR'd Arabic is, or null if not confident. Uses bigram CONTAINMENT
// (the fraction of the OCR's word-bigrams found in the verse) so a clean photo of an ayah -- even a
// partial line of a long one -- resolves to the right verse, while gibberish or a stray Arabic phrase
// resolves to nothing. Ties break toward the closest-length verse (the exact ayah, not a longer verse
// that merely contains the phrase). Returns { surah, ayah, score } or null.
function recognizeVerse(arabicOcr) {
  if (!AR_INDEX.length) return null;
  const norm = normalizeArabic(arabicOcr);
  const og = arBigrams(norm);
  if (og.size < 3) {
    if (norm.length < 6) return null; // too short to be distinctive
    const exact = AR_INDEX.find((v) => v.na === norm);
    return exact ? { surah: exact.s, ayah: exact.a, score: 1 } : null;
  }
  let best = null;
  for (const v of AR_INDEX) {
    let inter = 0;
    const [small, big] = og.size < v.bg.size ? [og, v.bg] : [v.bg, og];
    for (const x of small) if (big.has(x)) inter++;
    if (!inter) continue;
    const containment = inter / og.size;
    const lenGap = Math.abs(v.bg.size - og.size);
    if (!best || containment > best.containment || (containment === best.containment && lenGap < best.lenGap)) {
      best = { surah: v.s, ayah: v.a, containment, lenGap };
    }
  }
  return best && best.containment >= 0.6 ? { surah: best.surah, ayah: best.ayah, score: Number(best.containment.toFixed(3)) } : null;
}

// Fetch the tafsir rows for one specific verse (used by the recognition note).
async function fetchTafsir(surah, ayah) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/tafsir?surah=eq.${surah}&ayah=eq.${ayah}&select=surah,ayah,source,text&limit=2`,
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

module.exports = {
  CRISIS_RE,
  surahName,
  embedQuery,
  rpc,
  extraRefs,
  fetchVerses,
  ftsVerses,
  ftsTafsir,
  retrieveContext,
  buildCards,
  sanitizeRefs,
  recognizeVerse,
  fetchTafsir,
  STUDY_AID_DISCLAIMER,
};
