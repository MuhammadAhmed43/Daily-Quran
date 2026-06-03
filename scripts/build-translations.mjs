// Builds the extra English translations for the translation picker (Itani ships in quran.json already).
// Source: public-domain Pickthall + Yusuf Ali via alquran.cloud (same pipeline as build-quran.mjs).
// Output: mobile/assets/quran/tr/<id>.json = a flat map { "surah:ayah": "english text" } for all 6236.
// Run from the repo root:  node scripts/build-translations.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(HERE, 'data');
const OUT = join(ROOT, 'mobile', 'assets', 'quran', 'tr');

const EDITIONS = {
  pickthall: 'https://api.alquran.cloud/v1/quran/en.pickthall',
  yusufali: 'https://api.alquran.cloud/v1/quran/en.yusufali',
};

const BOM = /﻿/g;

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

mkdirSync(OUT, { recursive: true });
let allOk = true;

for (const id of Object.keys(EDITIONS)) {
  const ed = await loadEdition(id);
  const map = {};
  let count = 0;
  for (const su of ed.data.surahs) {
    for (const a of su.ayahs) {
      map[`${su.number}:${a.numberInSurah}`] = a.text.replace(BOM, '').trim();
      count++;
    }
  }
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(map), 'utf8');
  const ok = count === 6236;
  allOk = allOk && ok;
  console.log(`${id}: ${count} ayat -> ${ok ? 'OK' : 'FAIL'}`);
}

if (!allOk) process.exit(1);
console.log('Translations built. Integrity check passed (6236 each).');
