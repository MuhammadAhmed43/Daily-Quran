// Generate the app identity assets (icon / splash / android adaptive / favicon) from a hand-authored,
// fully aniconic SVG emblem: an open mushaf (Qur'an) cradled under a crescent + a small sparkle. No
// figures, no faces — depiction-safe. Brand teal gradient. Rasterized at every needed size via sharp.
//   node scripts/gen-app-icon.mjs       (needs: npm i sharp --no-save)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const DIR = new URL('../mobile/assets/images/', import.meta.url);
const p = (name) => fileURLToPath(new URL(name, DIR));

// brand palette
const G1 = '#0E8AAE';
const G2 = '#06425a'; // teal gradient (top -> bottom)
const CREAM = '#FBF7EC';
const SHADE = '#E7DEC6';
const LINE = '#0a7ea4';
const GOLD = '#F0C75E';

// open book: two pages meeting at a centre spine (x=512), gently drooping outward
function book({ page, shade, line }) {
  return `
    <path d="M512 540 C430 510 300 506 210 540 L210 700 C300 666 430 670 512 700 Z" fill="${page}"/>
    <path d="M512 540 C594 510 724 506 814 540 L814 700 C724 666 594 670 512 700 Z" fill="${page}"/>
    <path d="M512 540 L512 700" stroke="${shade}" stroke-width="10" stroke-linecap="round"/>
    ${
      line
        ? `<g fill="${line}" opacity="0.5">
        <rect x="252" y="584" width="200" height="12" rx="6"/>
        <rect x="252" y="616" width="200" height="12" rx="6"/>
        <rect x="252" y="648" width="156" height="12" rx="6"/>
        <rect x="572" y="584" width="200" height="12" rx="6"/>
        <rect x="572" y="616" width="200" height="12" rx="6"/>
        <rect x="616" y="648" width="156" height="12" rx="6"/>
      </g>`
        : ''
    }`;
}

// crescent via a masked circle (outer circle minus an offset inner circle), opening to the upper-right
function crescent(fill) {
  return `
    <defs><mask id="cm">
      <rect width="1024" height="1024" fill="black"/>
      <circle cx="512" cy="338" r="118" fill="white"/>
      <circle cx="558" cy="316" r="104" fill="black"/>
    </mask></defs>
    <rect width="1024" height="1024" fill="${fill}" mask="url(#cm)"/>`;
}

// a small four-point sparkle near the crescent
function spark(fill) {
  return `<path d="M392 250 L404 288 L442 300 L404 312 L392 350 L380 312 L342 300 L380 288 Z" fill="${fill}"/>`;
}

function emblem(mono = false) {
  const inner = mono
    ? crescent('#fff') + book({ page: '#fff', shade: '#fff', line: '' }) + spark('#fff')
    : crescent(GOLD) + book({ page: CREAM, shade: SHADE, line: LINE }) + spark(GOLD);
  return `<g transform="translate(0,26)">${inner}</g>`;
}

const grad = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${G1}"/><stop offset="1" stop-color="${G2}"/>
  </linearGradient></defs>`;

const svgOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">';

const tile = (rx = 0) =>
  `${svgOpen}${grad}<rect width="1024" height="1024" rx="${rx}" fill="url(#bg)"/>${emblem()}</svg>`;
const foreground = `${svgOpen}${emblem()}</svg>`; // emblem on transparent (android safe-zone padded)
const background = `${svgOpen}${grad}<rect width="1024" height="1024" fill="url(#bg)"/></svg>`;
const monochrome = `${svgOpen}${emblem(true)}</svg>`;

async function render(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(p(file));
  console.log(`  wrote ${file} (${size}px)`);
}

await render(tile(0), 'icon.png', 1024);
await render(tile(200), 'splash-icon.png', 1024);
await render(tile(150), 'favicon.png', 96);
await render(foreground, 'android-icon-foreground.png', 1024);
await render(background, 'android-icon-background.png', 1024);
await render(monochrome, 'android-icon-monochrome.png', 1024);
console.log('done.');
