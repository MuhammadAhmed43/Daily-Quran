// Dark-premium design tokens for the Daily Qur'an redesign. See C:\Quran-ChatApp\UI-REDESIGN-SPEC.md.
// A CURATED SET of dark-premium palettes behind PALETTE — flip PALETTE and reload to A/B any screen.
// Each is a complete, hand-tuned token set with a clear design lineage (see the header on each const).
// Dark-only (no light theme). Everything references these tokens — no scattered hard-coded colors.
//
//   mushaf   * THE REFERENCE - sampled from Ui-Design/color-pallete.png: sand-gold #F0B975 + silver
//              #BFBFBF + grey #5F5F5F on the app's real canvas #0F0E13 (the user's own design; default)
//   midnight  - deep indigo-navy + gold starlight ("Night of Power"; luxe celestial)
//   petrol    - jewel teal + warm sand-gold ("Museum of Islamic Art"; cool, modern)
//   oxblood   - deep wine/ruby + gold ("antique leather mushaf"; warm, scholarly)
//   dune      - warm taupe-charcoal + clay + bronze ("desert at dusk"; earthy, Aesop-minimal)
//   obsidian  - cool graphite neutral + emerald & gold pops ("Linear/Vercel"; ultra-minimal)
//   emerald   - deep jewel emerald + gold ("green-leather illuminated mushaf"; the classic)
//   amber     - single warm amber-gold on near-black (monochrome, restrained)
//   --- color-theory research set: net-new hue families + metals (see UI-REDESIGN-SPEC.md) ---
//   sapphire   - sapphire blue + PLATINUM, no gold (mono-cool; icy gem luxury)
//   amethyst   - royal violet + gold (split-complementary; Byzantine "gold over purple")
//   porphyry   - plum + SILVER (monochromatic cool; couture aubergine)
//   cedar      - pine/racing green + BRASS (analogous+metal; heritage library)
//   copperleaf - charcoal + COPPER/rose-gold (warm mono; tactile, artisanal)
//   espresso   - mocha brown + CARAMEL (warm mono; coffeehouse luxe)
//   cinema     - steel-blue + AMBER (true complementary; cool/warm cinematic)
//   onyx       - achromatic black + warm ivory, no metal (luxury by subtraction)z
//   bronze     - cool slate + antique BRONZE (near-complementary; museum artifact)
//   zaytun     - deep olive/drab green + old-gold (analogous earth; the blessed olive)
import { Platform, TextStyle } from 'react-native';

export type PaletteName =
  | 'mushaf'
  | 'midnight' | 'petrol' | 'oxblood' | 'dune' | 'obsidian' | 'emerald' | 'amber'
  | 'sapphire' | 'amethyst' | 'porphyry' | 'cedar' | 'copperleaf' | 'espresso' | 'cinema' | 'onyx'
  | 'bronze' | 'zaytun';
// FLIP THIS to compare any palette on-device (18 total — see the list above).
// `mushaf` is the default: the exact palette sampled from your Ui-Design/color-pallete.png reference.
export const PALETTE: PaletteName = 'onyx';

export type Palette = {
  bg: string; // app canvas
  bgRaised: string; // page sections behind cards
  navBar: string; // bottom tab bar
  surface1: string; // cards, rows
  surface2: string; // elevated cards, sheets
  surface3: string; // pressed / nested
  primary: string; // identity / selected
  primaryDeep: string; // gradient end
  primaryBright: string; // glow
  accent: string; // gold sacred/AI accent
  accentPressed: string;
  accentBright: string; // glow core
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  scriptureInk: string; // warm ivory for verse text/Arabic
  hairline: string;
  hairlineSoft: string;
  glassLip: string; // brighter top edge on glass
  success: string;
  streakFlame: string;
  warning: string;
  danger: string;
  info: string;
  // gradient stops
  goldGrad: [string, string]; // gold -> bronze
  primaryGrad: [string, string]; // emerald -> deep (amber: same as goldGrad)
  glowTop: [string, string, string]; // warm lit-from-above radial/linear stops (color -> faint -> transparent)
  cardScrim: [string, string]; // transparent -> dark (bottom->up on media)
};

const emerald: Palette = {
  // Deep jewel emerald + gold leaf on emerald-black (a green-leather, gold-illuminated mushaf).
  bg: '#04120C', // deep emerald-black canvas (very dark, real green depth)
  bgRaised: '#071A11',
  navBar: '#030D08',
  surface1: '#0A1F15', // rich deep-emerald cards
  surface2: '#0F2A1C', // elevated
  surface3: '#173522', // pressed/nested
  // The hero/identity emerald (fills, active, selected). Deep + jewel, NOT bright/kelly green.
  // Fine-tune the green by pasting one of these into `primary`:
  //   deeper #0B8559 · current #0E9F6B · vivid #12B07C · jade/teal-lean #0BA47F · forest #0A7A52
  primary: '#0E9F6B',
  primaryDeep: '#053D2B', // gradient end (deep forest)
  primaryBright: '#2FD79E', // glow / hover
  accent: '#E8B866', // gold (the sacred/AI light)
  accentPressed: '#C99A52',
  accentBright: '#F2C97A',
  textPrimary: '#EAF4EE', // cool ivory, faint green
  textSecondary: '#8FA99C',
  textMuted: '#566A5F',
  scriptureInk: '#F4EFE2', // warm ivory for verse text/Arabic
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#4FC58A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#5B8DEF',
  goldGrad: ['#F0C079', '#6E4E1C'],
  primaryGrad: ['#0E9F6B', '#053D2B'],
  glowTop: ['rgba(14,159,107,0.14)', 'rgba(232,184,102,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)'],
};

const amber: Palette = {
  bg: '#060606',
  bgRaised: '#0E0D0C',
  navBar: '#0F0E13',
  surface1: '#141414',
  surface2: '#1E1E1E',
  surface3: '#262626',
  primary: '#E8B866', // amber: identity == accent (single warm accent)
  primaryDeep: '#6E4E1C',
  primaryBright: '#F2C97A',
  accent: '#E8B866',
  accentPressed: '#C99A52',
  accentBright: '#F2C97A',
  textPrimary: '#F4F0E8',
  textSecondary: '#9A948A',
  textMuted: '#5F5F5F',
  scriptureInk: '#F5F1E8',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#5B8DEF',
  goldGrad: ['#F0C079', '#6E4E1C'],
  primaryGrad: ['#F0C079', '#6E4E1C'],
  glowTop: ['rgba(232,184,102,0.12)', 'rgba(232,184,102,0.04)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)'],
};

const midnight: Palette = {
  // Laylat al-Qadr — the night the Qur'an was revealed. Deep celestial navy, gold starlight.
  // Luxury-watch / premium night-mode lineage: a cool canvas with warm gold reserved for the sacred.
  bg: '#070B18', // deep navy-black, a breath of blue
  bgRaised: '#0B1124',
  navBar: '#05080F',
  surface1: '#111733', // deep indigo card
  surface2: '#18204A', // elevated
  surface3: '#212C5C', // pressed/nested
  primary: '#6E8AE0', // moonlight indigo (identity/selected) — luminous, never neon
  primaryDeep: '#1E2A5E', // gradient end
  primaryBright: '#93A9F0', // glow
  accent: '#E6C27A', // gold starlight (sacred/AI light)
  accentPressed: '#C9A35E',
  accentBright: '#F2D49A',
  textPrimary: '#E9ECFA', // cool moonlight ivory
  textSecondary: '#97A0C4',
  textMuted: '#5A6388',
  scriptureInk: '#F3EFE2', // warm ivory — scripture stays warm on the cool night
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#4FC58A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#E0655A',
  info: '#6E8AE0',
  goldGrad: ['#F0D094', '#7A5A22'],
  primaryGrad: ['#6E8AE0', '#1E2A5E'],
  glowTop: ['rgba(110,138,224,0.14)', 'rgba(230,194,122,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(4,7,16,0.74)'],
};

const petrol: Palette = {
  // Museum of Islamic Art / zellige tile — deep petrol teal (bluer than emerald) + warm sand-gold.
  // Cool, modern, calm; the warm gold is the deliberate counterpoint to the cool teal.
  bg: '#04141A', // deep petrol-black
  bgRaised: '#071E26',
  navBar: '#030E12',
  surface1: '#082530', // deep teal card
  surface2: '#0C313F', // elevated
  surface3: '#134150', // pressed/nested
  primary: '#1AA8A0', // jewel teal (identity/selected)
  primaryDeep: '#06403E', // gradient end
  primaryBright: '#38D6CC', // glow
  accent: '#E7C27E', // warm sand-gold
  accentPressed: '#C9A45F',
  accentBright: '#F2D49C',
  textPrimary: '#E4F1EF',
  textSecondary: '#8AA8A4',
  textMuted: '#4F6B68',
  scriptureInk: '#F4EFE2',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#3FC9A8',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#E0655A',
  info: '#3FB0C9',
  goldGrad: ['#F0C883', '#6E5022'],
  primaryGrad: ['#1AA8A0', '#06403E'],
  glowTop: ['rgba(26,168,160,0.13)', 'rgba(231,194,126,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(2,12,16,0.74)'],
};

const oxblood: Palette = {
  // Antique leather-bound mushaf / scholar's library — deep wine-ruby + gold leaf.
  // Warm, dignified, traditional-luxury. Muted (never bright red); the gold keeps it sacred.
  bg: '#150A0C', // deep oxblood-black
  bgRaised: '#1E0E11',
  navBar: '#0F0608',
  surface1: '#2A1216', // deep wine card
  surface2: '#371A1F', // elevated
  surface3: '#46232A', // pressed/nested
  primary: '#AE4750', // muted ruby/wine (identity/selected)
  primaryDeep: '#4A1A1E', // gradient end
  primaryBright: '#D17078', // glow
  accent: '#E3B871', // gold
  accentPressed: '#C49A56',
  accentBright: '#F0CB8C',
  textPrimary: '#F3E7E5',
  textSecondary: '#B59A98',
  textMuted: '#6E5450',
  scriptureInk: '#F5EEE2',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#C98A90',
  goldGrad: ['#EFC382', '#6E4E1C'],
  primaryGrad: ['#AE4750', '#4A1A1E'],
  glowTop: ['rgba(174,71,80,0.13)', 'rgba(227,184,113,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(12,5,7,0.74)'],
};

const dune: Palette = {
  // Desert at dusk — warm taupe-charcoal canvas, terracotta clay, soft bronze-gold.
  // Earthy, muted, Aesop / luxury-spa minimalism. A warm neutral, never pure black.
  bg: '#13100C', // warm charcoal-brown
  bgRaised: '#1B1712',
  navBar: '#0D0B08',
  surface1: '#242019', // warm taupe card
  surface2: '#2F2A21', // elevated
  surface3: '#3B342A', // pressed/nested
  primary: '#C2895C', // terracotta clay (identity/selected)
  primaryDeep: '#5E3F26', // gradient end
  primaryBright: '#E0A878', // glow
  accent: '#DEC489', // pale desert gold — lighter/yellower than the clay so the two read apart
  accentPressed: '#C0A66E',
  accentBright: '#ECD49E',
  textPrimary: '#F1E9DC',
  textSecondary: '#B0A491',
  textMuted: '#6B6253',
  scriptureInk: '#F5EFE0',
  hairline: 'rgba(255,255,255,0.07)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  glassLip: 'rgba(255,255,255,0.12)',
  success: '#7DAE6B',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#CC6A52',
  info: '#C2895C',
  goldGrad: ['#E6CB94', '#6E5328'],
  primaryGrad: ['#C2895C', '#5E3F26'],
  glowTop: ['rgba(194,137,92,0.12)', 'rgba(222,196,137,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(10,8,5,0.74)'],
};

const obsidian: Palette = {
  // Ultra-minimal "$100M product" — cool graphite near-black, one emerald pop + restrained gold for
  // the sacred. Linear / Vercel / Arc lineage: maximum restraint, color used surgically.
  bg: '#0A0B0D', // cool near-black graphite
  bgRaised: '#101114',
  navBar: '#070809',
  surface1: '#16181C', // graphite card
  surface2: '#1E2126', // elevated
  surface3: '#282C32', // pressed/nested
  primary: '#2BB27C', // refined emerald — the single color pop
  primaryDeep: '#0E4A35', // gradient end
  primaryBright: '#46D89C', // glow
  accent: '#D9B779', // restrained gold (sacred moments only)
  accentPressed: '#BF9E60',
  accentBright: '#ECCF95',
  textPrimary: '#ECEEF1', // cool white
  textSecondary: '#9BA1AC',
  textMuted: '#5A606B',
  scriptureInk: '#F4F1E9', // warm ivory pops against the cool graphite
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  glassLip: 'rgba(255,255,255,0.13)',
  success: '#2BB27C',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#E0655A',
  info: '#5B8DEF',
  goldGrad: ['#E6CB94', '#6E5328'],
  primaryGrad: ['#2BB27C', '#0E4A35'],
  glowTop: ['rgba(43,178,124,0.10)', 'rgba(217,183,121,0.04)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(6,7,9,0.76)'],
};

const sapphire: Palette = {
  // Sapphire set in PLATINUM — a cold stone with a white metal (B&O / Tiffany). The cleanest gap in the
  // set: a cool jewel with a COOL metal, zero gold. Mono-cool; chroma lives only in the sapphire.
  bg: '#080B12', // deep sapphire-black
  bgRaised: '#0C101A',
  navBar: '#06080F',
  surface1: '#0E131D', // cool blue-graphite card
  surface2: '#141A28', // elevated
  surface3: '#1C2436', // pressed/nested
  primary: '#2E6BD6', // sapphire (identity/selected)
  primaryDeep: '#11315F', // gradient end
  primaryBright: '#5A93F0', // glow
  accent: '#CDD3DC', // platinum — the cool metal that replaces gold
  accentPressed: '#AEB6C2',
  accentBright: '#E8ECF1',
  textPrimary: '#E9EDF5',
  textSecondary: '#97A2B6',
  textMuted: '#586278',
  scriptureInk: '#F2F0E8', // warm ivory — the only warm note, so scripture glows
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#4FC58A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#E0655A',
  info: '#5A93F0',
  goldGrad: ['#E8ECF1', '#7E8794'], // platinum sweep (the "metal" gradient)
  primaryGrad: ['#2E6BD6', '#11315F'],
  glowTop: ['rgba(46,107,214,0.13)', 'rgba(205,211,220,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(5,8,14,0.74)'],
};

const amethyst: Palette = {
  // Byzantine "gold over purple" — gold = divine light, purple = sacred authority (Ravenna mosaics,
  // Asprey Regal Amethyst). The most historically literal illuminated-manuscript palette here.
  bg: '#0D0816', // deep aubergine-black
  bgRaised: '#120B1C',
  navBar: '#0A0612',
  surface1: '#140D20', // deep violet card
  surface2: '#1B132B', // elevated
  surface3: '#251B39', // pressed/nested
  primary: '#7C4FC9', // royal amethyst (identity/selected)
  primaryDeep: '#3A1F66', // gradient end
  primaryBright: '#A07CE0', // glow
  accent: '#E3C277', // gold (the divine light)
  accentPressed: '#C7A65E',
  accentBright: '#F1D699',
  textPrimary: '#EDE8F6',
  textSecondary: '#A99CC2',
  textMuted: '#665A7E',
  scriptureInk: '#F4EFE2',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#A07CE0',
  goldGrad: ['#F0D094', '#7A5A22'],
  primaryGrad: ['#7C4FC9', '#3A1F66'],
  glowTop: ['rgba(124,79,201,0.14)', 'rgba(227,194,119,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(8,5,12,0.74)'],
};

const porphyry: Palette = {
  // Aubergine + brushed SILVER — amethyst restated as cold couture (NARS / Asprey, no gold).
  // Monochromatic cool: a violet jewel + silver = one tonal zone, pure value sophistication.
  bg: '#0C0A12', // plum-black
  bgRaised: '#110E18',
  navBar: '#09080F',
  surface1: '#13101B', // plum-graphite card
  surface2: '#1A1624', // elevated
  surface3: '#241F31', // pressed/nested
  primary: '#8159C9', // plum (identity/selected)
  primaryDeep: '#3E2A63', // gradient end
  primaryBright: '#A684E2', // glow
  accent: '#C9C6D2', // cool silver-lilac (the metal)
  accentPressed: '#ABA7B6',
  accentBright: '#E6E3EC',
  textPrimary: '#ECE9F3',
  textSecondary: '#A69EB6',
  textMuted: '#625A72',
  scriptureInk: '#F3F0E9',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#A684E2',
  goldGrad: ['#E6E3EC', '#83808D'], // silver sweep
  primaryGrad: ['#8159C9', '#3E2A63'],
  glowTop: ['rgba(129,89,201,0.13)', 'rgba(201,198,210,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(7,6,11,0.74)'],
};

const cedar: Palette = {
  // Mayfair racing-green + antique BRASS (Aston Martin / Savile Row). A different green from emerald:
  // pine/forest, bluer and heritage — with a greener, older metal. Analogous + metal; old-money calm.
  bg: '#08120D', // deep pine-black
  bgRaised: '#0C1812',
  navBar: '#060F0A',
  surface1: '#0D1A13', // forest card
  surface2: '#12241A', // elevated
  surface3: '#1A3124', // pressed/nested
  primary: '#2F7D5B', // pine / racing green (identity/selected)
  primaryDeep: '#123E2C', // gradient end
  primaryBright: '#4FA87C', // glow
  accent: '#BBA15E', // antique brass (older / greener than gold)
  accentPressed: '#9E8649',
  accentBright: '#D4BE80',
  textPrimary: '#E7EFE9',
  textSecondary: '#94A89C',
  textMuted: '#566459',
  scriptureInk: '#F4EFE2',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#4FC58A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#4FA87C',
  goldGrad: ['#D4BE80', '#6E5C2A'], // brass sweep
  primaryGrad: ['#2F7D5B', '#123E2C'],
  glowTop: ['rgba(47,125,91,0.13)', 'rgba(187,161,94,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(5,12,8,0.74)'],
};

const copperleaf: Palette = {
  // Brushed COPPER / rose-gold on smoky charcoal (Cartier Atelier; walnut-and-copper interiors).
  // A warm metal the set lacks; the canvas is near-neutral so the copper is unmistakably the star.
  bg: '#0D0B0A', // smoky charcoal
  bgRaised: '#14100E',
  navBar: '#0A0807',
  surface1: '#15110F', // warm graphite card
  surface2: '#1D1815', // elevated
  surface3: '#28201C', // pressed/nested
  primary: '#C57A4B', // copper (identity/selected)
  primaryDeep: '#6E3F25', // gradient end
  primaryBright: '#E09A6B', // glow
  accent: '#C98A78', // rose-gold lift
  accentPressed: '#AD7363',
  accentBright: '#E0A693',
  textPrimary: '#F1EAE4',
  textSecondary: '#B2A498',
  textMuted: '#6B6055',
  scriptureInk: '#F5EFE2',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.13)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#C98A78',
  goldGrad: ['#E09A6B', '#6E3F25'], // copper sweep
  primaryGrad: ['#C57A4B', '#6E3F25'],
  glowTop: ['rgba(197,122,75,0.13)', 'rgba(201,138,120,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(8,6,5,0.74)'],
};

const espresso: Palette = {
  // Mocha + CARAMEL — warm-on-warm coffeehouse luxe (Bottega brown; walnut and cream). The set's only
  // true brown. Monochromatic warm: one hue from canvas to caramel; the most "expensive-quiet" structure.
  bg: '#0F0B07', // espresso-black
  bgRaised: '#16100A',
  navBar: '#0B0805',
  surface1: '#17110B', // roasted card
  surface2: '#1F1810', // elevated
  surface3: '#2B2117', // pressed/nested
  primary: '#B07D4B', // warm coffee-caramel (identity/selected)
  primaryDeep: '#5E3F22', // gradient end
  primaryBright: '#D6A368', // glow
  accent: '#E6C088', // caramel (the light)
  accentPressed: '#C9A36E',
  accentBright: '#F2D6A4',
  textPrimary: '#F2EADF',
  textSecondary: '#B4A48F',
  textMuted: '#6E6050',
  scriptureInk: '#F6EFE0',
  hairline: 'rgba(255,255,255,0.07)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  glassLip: 'rgba(255,255,255,0.12)',
  success: '#7DAE6B',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#CC6A52',
  info: '#D6A368',
  goldGrad: ['#F2D6A4', '#6E4E22'], // caramel sweep
  primaryGrad: ['#B07D4B', '#5E3F22'],
  glowTop: ['rgba(176,125,75,0.13)', 'rgba(230,192,136,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(8,6,4,0.74)'],
};

const cinema: Palette = {
  // Steel-blue + AMBER — the true "teal & orange" complementary, restated cool-cinematic. Warm advances,
  // cool recedes: maximum foreground/background separation. The set's only real complement; meter the amber.
  bg: '#0A0E14', // cool slate-black
  bgRaised: '#0E131C',
  navBar: '#070A10',
  surface1: '#0F141D', // slate card
  surface2: '#151C28', // elevated
  surface3: '#1E2736', // pressed/nested
  primary: '#4C84C4', // steel / harbor blue, desaturated (identity/selected)
  primaryDeep: '#1E3F63', // gradient end
  primaryBright: '#74A6E0', // glow
  accent: '#E0A24E', // amber (the warm sacred light; use sparingly)
  accentPressed: '#C4883C',
  accentBright: '#F0BE78',
  textPrimary: '#E8EDF4',
  textSecondary: '#94A1B6',
  textMuted: '#566276',
  scriptureInk: '#F4EFE2',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#4FC58A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#E0655A',
  info: '#74A6E0',
  goldGrad: ['#F0BE78', '#6E4E1C'], // amber sweep
  primaryGrad: ['#4C84C4', '#1E3F63'],
  glowTop: ['rgba(76,132,196,0.13)', 'rgba(224,162,78,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(5,8,14,0.74)'],
};

const onyx: Palette = {
  // Luxury by subtraction — achromatic onyx + warm ivory, NO metal, NO jewel (Chanel / Aesop / Saint
  // Laurent black-and-cream). Identity is value contrast + one ivory; nothing to clash or date.
  bg: '#0A0A0A', // onyx
  bgRaised: '#101010',
  navBar: '#060606',
  surface1: '#121212', // graphite card
  surface2: '#1A1A1A', // elevated
  surface3: '#242424', // pressed/nested
  primary: '#EDE7DA', // warm ivory IS the identity (selected = ivory; lean on weight/border for state)
  primaryDeep: '#9A8F7C', // gradient end
  primaryBright: '#F6F1E6', // glow
  accent: '#C9BDA6', // champagne-stone (barely-there metal)
  accentPressed: '#ADA189',
  accentBright: '#E3D9C4',
  textPrimary: '#F0EDE6',
  textSecondary: '#A09A8E',
  textMuted: '#5E5A52',
  scriptureInk: '#F6F1E6',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  glassLip: 'rgba(255,255,255,0.13)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#8E96A2',
  goldGrad: ['#E3D9C4', '#8A7F6A'], // champagne sweep
  primaryGrad: ['#EDE7DA', '#9A8F7C'],
  glowTop: ['rgba(237,231,218,0.08)', 'rgba(201,189,166,0.04)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(5,5,5,0.78)'],
};

const mushaf: Palette = {
  // * THE REFERENCE * Sampled directly from Ui-Design/color-pallete.png on the app's real canvas.
  // Soft sand-gold leaf (#F0B975 -> bronze #77521D) + cool SILVER (#BFBFBF) on a faint-violet near-black.
  // Gold is the hero (fills, cards, Arabic, active states); silver + grey are the neutral ramp.
  bg: '#0F0E13', // exact app canvas (deep near-black, a breath of cool violet)
  bgRaised: '#131217', // exact (sampled raised area)
  navBar: '#0B0A0F',
  surface1: '#1A1920', // cool-grey card
  surface2: '#232128', // elevated
  surface3: '#2C2A32', // pressed/nested (echoes the #323232 reference backdrop)
  primary: '#F0B975', // THE sand-gold — identity == accent (a single hero metal)
  primaryDeep: '#77521D', // bronze (exact gradient end)
  primaryBright: '#F7CE96', // gold glow
  accent: '#F0B975', // gold sacred/AI light (same hero gold)
  accentPressed: '#D49E5A',
  accentBright: '#F7CE96',
  textPrimary: '#F4F3F0', // clean near-white (surah titles)
  textSecondary: '#BFBFBF', // SILVER (exact reference swatch)
  textMuted: '#5F5F5F', // grey (exact reference swatch)
  scriptureInk: '#F5EEDD', // warm ivory for verse/Arabic
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.14)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#BFBFBF',
  goldGrad: ['#F0B975', '#77521D'], // exact reference gold -> bronze
  primaryGrad: ['#F0B975', '#77521D'],
  glowTop: ['rgba(240,185,117,0.12)', 'rgba(240,185,117,0.04)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(15,14,19,0.76)'],
};

const bronze: Palette = {
  // Cool slate + antique BRONZE — an artifact in a museum vitrine. The cool stone canvas vs the warm
  // patinated bronze is a muted near-complementary (temperature contrast, not chroma). Archival, weighty.
  bg: '#0B0C0D', // cool slate near-black
  bgRaised: '#121315',
  navBar: '#08090A',
  surface1: '#191B1E', // slate card
  surface2: '#23272B', // elevated
  surface3: '#2D3137', // pressed/nested
  primary: '#9C8757', // patinated bronze — identity IS the metal
  primaryDeep: '#5C4E2E', // gradient end
  primaryBright: '#C2AC78', // glow
  accent: '#CBB98C', // lit bronze / champagne
  accentPressed: '#AE9C6E',
  accentBright: '#E2D2A8',
  textPrimary: '#ECEEF0', // cool white
  textSecondary: '#9CA1A8',
  textMuted: '#5C616A',
  scriptureInk: '#F4EFE2', // warm ivory pops on the cool slate
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.13)',
  success: '#5BBF8A',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#D9594C',
  info: '#8FA0B0',
  goldGrad: ['#E2D2A8', '#5C4E2E'], // bronze / champagne sweep
  primaryGrad: ['#9C8757', '#5C4E2E'],
  glowTop: ['rgba(156,135,87,0.12)', 'rgba(203,185,140,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(8,9,10,0.74)'],
};

const zaytun: Palette = {
  // The blessed olive (zaytun) — deep olive/drab green + antique old-gold. Olive and old-gold are
  // adjacent yellow-greens, so it is a tight analogous earth family. Organic, humble, contemplative.
  bg: '#0D0F08', // deep olive-black
  bgRaised: '#13160C',
  navBar: '#090B06',
  surface1: '#1A1E11', // olive card
  surface2: '#262B19', // elevated
  surface3: '#313722', // pressed/nested
  primary: '#7E8C43', // olive (identity/selected)
  primaryDeep: '#3E471F', // gradient end
  primaryBright: '#A4B266', // glow
  accent: '#C2A062', // antique old-gold
  accentPressed: '#A98B53',
  accentBright: '#DABA82',
  textPrimary: '#ECEDE0',
  textSecondary: '#A8AC92',
  textMuted: '#646955',
  scriptureInk: '#F4EFE0',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.06)',
  glassLip: 'rgba(255,255,255,0.13)',
  success: '#7DAE6B',
  streakFlame: '#E8A53A',
  warning: '#E0A21E',
  danger: '#CC6A52',
  info: '#A4B266',
  goldGrad: ['#DABA82', '#6E5A2A'], // old-gold sweep
  primaryGrad: ['#7E8C43', '#3E471F'],
  glowTop: ['rgba(126,140,67,0.12)', 'rgba(194,160,98,0.05)', 'transparent'],
  cardScrim: ['rgba(0,0,0,0)', 'rgba(8,10,5,0.74)'],
};

export const palettes = {
  mushaf,
  midnight, petrol, oxblood, dune, obsidian, emerald, amber,
  sapphire, amethyst, porphyry, cedar, copperleaf, espresso, cinema, onyx,
  bronze, zaytun,
};
export const c: Palette = palettes[PALETTE];

// gradient direction presets (for expo-linear-gradient): ~135deg
export const grad = {
  diagStart: { x: 0, y: 0 },
  diagEnd: { x: 1, y: 1 },
  vert: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
};

export const radius = { full: 999, xl: 24, lg: 20, md: 16, sm: 14, xs: 12, badge: 10 };

export const space = { xs: 4, sm: 8, md: 12, gutter: 16, card: 20, section: 24, hero: 32 } as const;

// Font families (loaded in _layout.tsx). Fraunces = editorial serif (scripture/titles); Inter = UI sans;
// AmiriQuran = Uthmani Arabic (already bundled).
export const font = {
  serif: 'Fraunces_600SemiBold',
  serifMed: 'Fraunces_500Medium',
  serifReg: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMed: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  arabic: 'AmiriQuran',
} as const;

// Type scale (color applied per-use unless noted). Returns plain TextStyle objects.
export const type: Record<string, TextStyle> = {
  display: { fontFamily: font.serif, fontSize: 34, lineHeight: 40, color: c.textPrimary },
  h1: { fontFamily: font.serif, fontSize: 27, lineHeight: 33, color: c.textPrimary },
  h2: { fontFamily: font.serif, fontSize: 21, lineHeight: 27, color: c.textPrimary },
  cardTitle: { fontFamily: font.serif, fontSize: 17, lineHeight: 23, color: c.textPrimary },
  verseEn: { fontFamily: font.serifItalic, fontSize: 18, lineHeight: 28, color: c.scriptureInk },
  verseAr: { fontFamily: font.arabic, fontSize: 25, lineHeight: 50, color: c.scriptureInk, textAlign: 'right', writingDirection: 'rtl' },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 23, color: c.textSecondary },
  subtitle: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: c.textMuted },
  eyebrow: { fontFamily: font.sansBold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: c.accent },
  caption: { fontFamily: font.sansMed, fontSize: 11.5, lineHeight: 16, color: c.textMuted },
  button: { fontFamily: font.sansSemi, fontSize: 16, color: c.bg },
};

export const motion = {
  durMicro: 150,
  durBase: 280,
  durStep: 320,
  durSheet: 460,
  springSheet: { damping: 18, stiffness: 140, mass: 1 },
  springPress: { damping: 15, stiffness: 320, mass: 0.6 },
  staggerChip: 35,
  staggerCard: 70,
  pressScale: 0.97,
} as const;

// Soft low card shadow.
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
};

// Gold/emerald glow recipe for key CTAs / active states. Use sparingly.
export const glow = (color: string, strength = 0.3, rad = 16) => ({
  shadowColor: color,
  shadowOpacity: strength,
  shadowRadius: rad,
  shadowOffset: { width: 0, height: 0 },
  elevation: Platform.OS === 'android' ? 8 : 0,
});

export const theme = { c, palettes, PALETTE, grad, radius, space, font, type, motion, shadow, glow };
export default theme;
