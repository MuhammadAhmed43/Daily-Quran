// Verify Story JSONs: every panel.verse resolves in the bundled Qur'an, all fields present,
// motion in the allowed set, color is a hex, exactly 10 panels, and — the aniconic safety
// gate — the art `scene` names NO living being. Prints each resolved verse to eyeball fit.
//   node scripts/verify-stories.mjs                 # every story in mobile/assets/stories
//   node scripts/verify-stories.mjs nuh ibrahim     # only these
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'mobile', 'assets', 'stories');
const quran = JSON.parse(readFileSync(join(HERE, '..', 'mobile', 'assets', 'quran', 'quran.json'), 'utf8'));
const SUR = new Map(quran.surahs.map((s) => [s.number, s]));
const ayahOf = (s, a) => SUR.get(s)?.ayahs.find((x) => x.n === a);

const MOTIONS = new Set(['zoomIn', 'zoomOut', 'panLeft', 'panRight', 'rise', 'sink']);
const BANNED = [
  'person', 'people', 'man', 'men', 'woman', 'women', 'child', 'children', 'boy', 'girl', 'baby', 'infant',
  'figure', 'figures', 'silhouette', 'silhouettes', 'human', 'humans', 'face', 'faces', 'body', 'bodies',
  'hand', 'hands', 'arm', 'arms', 'crowd', 'king', 'queen', 'prophet', 'angel', 'angels', 'soldier', 'soldiers',
  'army', 'animal', 'animals', 'creature', 'creatures', 'beast', 'bird', 'birds', 'fish', 'whale', 'cow', 'cows',
  'ant', 'ants', 'dog', 'horse', 'horses', 'camel', 'camels', 'sheep', 'ram', 'lion', 'snake', 'serpent', 'dove', 'hoopoe',
];
const bannedRe = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i');
const REQUIRED = ['n', 'title', 'ref', 'verse', 'narration', 'visual', 'scene', 'color', 'motion'];

const ids = process.argv.slice(2);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => (ids.length ? ids.includes(f.replace('.json', '')) : true));

let bad = 0;
for (const f of files) {
  const story = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  console.log(`\n=== ${story.id} — "${story.title}" · ${story.panels.length} panels · surah ${story.surah} · ${story.arabicName} ===`);
  if (story.panels.length !== 10) {
    console.log(`  ! expected 10 panels, got ${story.panels.length}`);
    bad++;
  }
  for (const p of story.panels) {
    const errs = [];
    for (const k of REQUIRED) if (p[k] == null || p[k] === '') errs.push(`missing ${k}`);
    if (p.motion && !MOTIONS.has(p.motion)) errs.push(`bad motion "${p.motion}"`);
    if (p.color && !/^#[0-9a-fA-F]{6}$/.test(p.color)) errs.push(`bad color "${p.color}"`);
    let txt = '';
    const m = String(p.verse).match(/^(\d+):(\d+)$/);
    if (!m) errs.push(`bad verse "${p.verse}"`);
    else {
      const a = ayahOf(+m[1], +m[2]);
      if (!a) errs.push(`verse ${p.verse} not found`);
      else txt = a.en;
    }
    const hit = p.scene && String(p.scene).match(bannedRe);
    if (hit) errs.push(`scene names a living being: "${hit[0]}"`);
    if (errs.length) bad++;
    console.log(`  p${String(p.n).padStart(2, '0')} ${String(p.verse).padEnd(8)} ${p.title}${errs.length ? '   !! ' + errs.join('; ') : ''}`);
    if (txt) console.log(`        "${txt.slice(0, 96)}${txt.length > 96 ? '…' : ''}"`);
  }
}
console.log(bad ? `\n${bad} problem(s) found.` : `\nAll good — every verse resolves, every scene is aniconic.`);
