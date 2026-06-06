// welcome.ts — a warm, ROTATING welcome for the Ask tab's empty state: a gentle greeting + a comforting
// verse that changes every new conversation. Deliberately DISTINCT from Today's calendar Verse of the Day
// (that one is "the day's verse for everyone"; this one is a personal starting point — a soft way in).
// Verses are referenced by surah:ayah and rendered from the verified bundle elsewhere (never AI-generated);
// hand-picked for mercy / ease / nearness so the very first thing a user sees is reassuring.
//
// ⚠️ The verse choices are for human review — pastoral fit matters here.

export type Welcome = { surah: number; ayah: number; greeting: string };

const WELCOME_REFS: { surah: number; ayah: number }[] = [
  { surah: 13, ayah: 28 }, // in the remembrance of God do hearts find rest
  { surah: 94, ayah: 6 }, // indeed, with hardship comes ease
  { surah: 2, ayah: 152 }, // remember Me; I will remember you
  { surah: 39, ayah: 53 }, // do not despair of the mercy of God
  { surah: 65, ayah: 3 }, // whoever relies on God, He is sufficient for him
  { surah: 2, ayah: 186 }, // I am near; I answer the call of the caller
  { surah: 93, ayah: 7 }, // He found you lost and guided you
  { surah: 50, ayah: 16 }, // We are nearer to him than his jugular vein
  { surah: 40, ayah: 60 }, // call upon Me; I will respond to you
  { surah: 2, ayah: 286 }, // God does not burden a soul beyond its capacity
  { surah: 3, ayah: 139 }, // do not lose heart, nor fall into despair
  { surah: 64, ayah: 11 }, // whoever believes in God, He guides his heart
];

const GREETINGS = [
  'Whatever is on your heart, you can bring it here.',
  'Take a breath. What would you like to understand?',
  'A quiet place to ask, reflect, and seek guidance.',
  'However you arrive today, there is room for it here.',
  'Ask gently, ask honestly — let us begin.',
  'Bismillah. Where would you like to start?',
];

let last = -1;

/** A fresh welcome (a comforting verse + a greeting), different from the previous one. Call once when a new
 *  conversation begins; hold the result in state so it stays put while the empty state is shown. */
export function freshWelcome(): Welcome {
  let i = last;
  if (WELCOME_REFS.length > 1) {
    while (i === last) i = Math.floor(Math.random() * WELCOME_REFS.length);
  } else {
    i = 0;
  }
  last = i;
  const ref = WELCOME_REFS[i];
  return { surah: ref.surah, ayah: ref.ayah, greeting: GREETINGS[i % GREETINGS.length] };
}

// FNV-1a → a stable non-negative int, so a given calendar day always maps to the same verse.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The welcome for TODAY — deterministic by calendar day, so it stays put all day and only changes at the
 *  next local midnight (NOT on every revisit). Still distinct from Today's calendar Verse of the Day. */
export function dailyWelcome(date: Date = new Date()): Welcome {
  const i = hashStr(dayString(date)) % WELCOME_REFS.length;
  const ref = WELCOME_REFS[i];
  return { surah: ref.surah, ayah: ref.ayah, greeting: GREETINGS[i % GREETINGS.length] };
}
