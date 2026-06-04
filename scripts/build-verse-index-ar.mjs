// Build a normalized-Arabic index of all 6236 verses for image verse-recognition (api/see.js).
// Strips tashkeel / Quranic annotation marks / tatweel and unifies letter forms (alef wasla + hamza
// variants -> alef, alef-maqsura -> ya, ta-marbuta -> ha, etc.) so OCR'd Arabic can be fuzzily matched
// against it. Output: api/verse-index-ar.json = [{ s, a, na }] (na = normalized Arabic). Commit it.
//   node scripts/build-verse-index-ar.mjs
// IMPORTANT: keep normalizeArabic() IDENTICAL to api/_rag.js + test-recognize.mjs. Implemented with
// numeric code points (no literal Arabic / no \u ranges) so it is unambiguous + identical everywhere.
import { readFileSync, writeFileSync } from 'node:fs';

const QURAN = JSON.parse(readFileSync(new URL('../mobile/assets/quran/quran.json', import.meta.url), 'utf8'));

function normalizeArabic(s) {
  let out = '';
  for (const ch of s || '') {
    const c = ch.codePointAt(0);
    // strip: marks 0x610-0x61A, harakat/tanwin/shadda/sukun 0x64B-0x65F, superscript alef 0x670,
    // Quranic annotation signs 0x6D6-0x6ED, tatweel 0x640
    if ((c >= 0x610 && c <= 0x61a) || (c >= 0x64b && c <= 0x65f) || c === 0x670 || (c >= 0x6d6 && c <= 0x6ed) || c === 0x640) continue;
    let n = c;
    if (c === 0x622 || c === 0x623 || c === 0x625 || c === 0x671) n = 0x627; // alef variants + alef-wasla -> alef
    else if (c === 0x649) n = 0x64a; // alef-maqsura -> ya
    else if (c === 0x629) n = 0x647; // ta-marbuta -> ha
    else if (c === 0x624) n = 0x648; // waw-hamza -> waw
    else if (c === 0x626) n = 0x64a; // ya-hamza -> ya
    if (n >= 0x621 && n <= 0x64a) out += String.fromCharCode(n); // keep base Arabic letters
    else out += ' '; // everything else (incl. spaces/punct/digits) -> space
  }
  return out.replace(/\s+/g, ' ').trim();
}

const out = [];
for (const sur of QURAN.surahs) {
  for (const ay of sur.ayahs) {
    out.push({ s: sur.number, a: ay.n, na: normalizeArabic(ay.ar) });
  }
}

const dest = new URL('../api/verse-index-ar.json', import.meta.url);
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${out.length} verses -> api/verse-index-ar.json`);
console.log('1:1 ->', out[0].na); // sanity: should be the bare basmala
