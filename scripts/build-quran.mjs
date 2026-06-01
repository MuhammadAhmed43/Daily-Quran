// Builds the app's bundled Qur'an data from verified source editions.
// Source: Tanzil Uthmani text + Pickthall translation (public domain), via alquran.cloud.
// Self-contained: downloads the source editions if they are not already present.
// Run from the repo root:  node scripts/build-quran.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(HERE, 'data');
const OUT = join(ROOT, 'mobile', 'assets', 'quran');

const EDITIONS = {
  uthmani: 'https://api.alquran.cloud/v1/quran/quran-uthmani',
  pickthall: 'https://api.alquran.cloud/v1/quran/en.pickthall',
};

const BOM = /﻿/g; // strip stray byte-order-mark artifacts from the verified text

async function loadEdition(name) {
  const path = join(DATA, `${name}.json`);
  if (!existsSync(path)) {
    mkdirSync(DATA, { recursive: true });
    console.log(`Downloading ${name}…`);
    const res = await fetch(EDITIONS[name]);
    if (!res.ok) throw new Error(`Failed to download ${name}: ${res.status}`);
    writeFileSync(path, await res.text(), 'utf8');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const u = await loadEdition('uthmani');
const p = await loadEdition('pickthall');

const surahs = u.data.surahs.map((su, i) => {
  const sp = p.data.surahs[i];
  const ayahs = su.ayahs.map((a, j) => ({
    n: a.numberInSurah,
    ar: a.text.replace(BOM, '').trim(),
    en: sp.ayahs[j].text.replace(BOM, '').trim(),
  }));
  return {
    number: su.number,
    name: su.name.replace(BOM, '').trim(),
    englishName: su.englishName,
    englishNameTranslation: su.englishNameTranslation,
    revelationType: su.revelationType,
    numberOfAyahs: ayahs.length,
    ayahs,
  };
});

const ayahCount = surahs.reduce((sum, s) => sum + s.ayahs.length, 0);
const meta = {
  source: 'Tanzil Uthmani (via alquran.cloud)',
  translation: 'Pickthall, 1930 (public domain)',
  numbering: 'Hafs / Kufan (6236)',
  surahCount: surahs.length,
  ayahCount,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'quran.json'), JSON.stringify({ ...meta, surahs }), 'utf8');
writeFileSync(join(OUT, 'surahs.json'), JSON.stringify(surahs.map(({ ayahs, ...m }) => m)), 'utf8');

// Integrity check against the known Hafs/Kufan totals — a single wrong count fails the build.
const ok = surahs.length === 114 && ayahCount === 6236 && surahs[0].ayahs.length === 7;
console.log(`surahs=${surahs.length}, ayahs=${ayahCount}, al-Fatiha=${surahs[0].ayahs.length} ayat → ${ok ? 'OK' : 'FAIL'}`);
if (!ok) process.exit(1);
console.log('Integrity check passed.');
