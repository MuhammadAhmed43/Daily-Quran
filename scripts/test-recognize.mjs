// Verifies the verse-recognition matcher (api/_rag.js recognizeVerse) WITHOUT a device or OCR images:
// mirrors normalizeArabic + recognizeVerse, builds the index from quran.json, and checks that real
// verse Arabic resolves to the right surah:ayah, that mild OCR noise still resolves, and that
// non-Quran Arabic resolves to nothing (we decline rather than mis-identify scripture).
//   node scripts/test-recognize.mjs
// Keep normalizeArabic/arBigrams/recognizeVerse in lockstep with api/_rag.js.
import { readFileSync } from 'node:fs';

const QURAN = JSON.parse(readFileSync(new URL('../mobile/assets/quran/quran.json', import.meta.url), 'utf8'));

function normalizeArabic(s) {
  let out = '';
  for (const ch of s || '') {
    const c = ch.codePointAt(0);
    if ((c >= 0x610 && c <= 0x61a) || (c >= 0x64b && c <= 0x65f) || c === 0x670 || (c >= 0x6d6 && c <= 0x6ed) || c === 0x640) continue;
    let n = c;
    if (c === 0x622 || c === 0x623 || c === 0x625 || c === 0x671) n = 0x627;
    else if (c === 0x649) n = 0x64a;
    else if (c === 0x629) n = 0x647;
    else if (c === 0x624) n = 0x648;
    else if (c === 0x626) n = 0x64a;
    if (n >= 0x621 && n <= 0x64a) out += String.fromCharCode(n);
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
const AR_INDEX = [];
for (const sur of QURAN.surahs) {
  for (const ay of sur.ayahs) {
    const na = normalizeArabic(ay.ar);
    AR_INDEX.push({ s: sur.number, a: ay.n, na, bg: arBigrams(na) });
  }
}
function recognizeVerse(arabicOcr) {
  if (!AR_INDEX.length) return null;
  const norm = normalizeArabic(arabicOcr);
  const og = arBigrams(norm);
  if (og.size < 3) {
    if (norm.length < 6) return null;
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

const raw = (s, a) => QURAN.surahs[s - 1].ayahs.find((x) => x.n === a).ar;
let fails = 0;
const ok = (c, m) => {
  if (!c) fails++;
  console.log((c ? '  OK  ' : '  XX  ') + m);
};

console.log('exact recognition (clean verse Arabic -> its surah:ayah)');
for (const [s, a] of [[1, 1], [2, 255], [112, 1], [112, 2], [1, 7], [114, 1], [18, 10], [3, 8], [2, 2], [55, 13]]) {
  const r = recognizeVerse(raw(s, a));
  ok(r && r.surah === s && r.ayah === a, `${s}:${a} -> ${r ? `${r.surah}:${r.ayah} (${r.score})` : 'null'}`);
}

console.log('\nOCR noise tolerance (drop the last word + a trailing char on long verses)');
function noisy(ar) {
  const ws = ar.split(' ');
  if (ws.length > 4) ws.pop();
  return ws.join(' ').replace(/.$/, '');
}
for (const [s, a] of [[2, 255], [18, 10], [3, 8], [2, 285]]) {
  const r = recognizeVerse(noisy(raw(s, a)));
  ok(r && r.surah === s && r.ayah === a, `noisy ${s}:${a} -> ${r ? `${r.surah}:${r.ayah} (${r.score})` : 'null'}`);
}

console.log('\ndecline non-scripture / gibberish (must be null -- never mis-identify)');
ok(recognizeVerse('') === null, 'empty -> null');
ok(recognizeVerse('قطه كلب سياره حاسوب طاوله كرسي نافذه مفتاح') === null, 'unrelated nouns -> null');
ok(recognizeVerse('مرحبا كيف حالك اليوم يا صديقي العزيز') === null, 'casual sentence -> null');

console.log('\ndeterminism');
ok(JSON.stringify(recognizeVerse(raw(2, 255))) === JSON.stringify(recognizeVerse(raw(2, 255))), 'same input -> same result');

console.log(fails === 0 ? '\nVERSE RECOGNITION VERIFIED' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
