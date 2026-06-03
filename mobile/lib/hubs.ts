// Topical hubs — curated entry points by feeling/need. Each hub is a compassionate framing plus a
// HAND-VETTED set of verses (referenced by surah:ayah and rendered from the bundled Qur'an data —
// never AI-generated scripture). Framed around the need, not a sin-label, so the app meets people
// with mercy. Sensitive hubs (despair) carry a crisis/reach-out card.
//
// ⚠️ The verse choices below are for human review — accuracy and pastoral fit matter here.

export type Hub = {
  id: string;
  title: string;
  emoji: string;
  blurb: string; // one line for the list card
  intro: string; // compassionate framing on the detail screen
  verses: { surah: number; ayah: number }[];
  starter: string; // pre-seeds the "Talk it through" chat
  crisis?: boolean; // show the crisis/reach-out card (despair / self-harm)
};

export const HUBS: Hub[] = [
  {
    id: 'anxiety',
    title: 'Anxiety & worry',
    emoji: '🌿',
    blurb: 'When the mind won’t settle',
    intro:
      'When worry tightens the chest, the Qur’an turns the heart toward the One who holds every outcome. You are not carrying this alone.',
    verses: [
      { surah: 13, ayah: 28 },
      { surah: 2, ayah: 286 },
      { surah: 94, ayah: 5 },
      { surah: 94, ayah: 6 },
      { surah: 65, ayah: 3 },
      { surah: 2, ayah: 153 },
    ],
    starter: 'I’ve been feeling anxious and worried lately. What does the Qur’an say to calm the heart?',
  },
  {
    id: 'grief',
    title: 'Sadness & grief',
    emoji: '🕊️',
    blurb: 'When the heart is heavy',
    intro:
      'Grief is not a lack of faith — even prophets wept. The Qur’an makes room for sorrow while gently pointing to comfort and reunion.',
    verses: [
      { surah: 2, ayah: 155 },
      { surah: 2, ayah: 156 },
      { surah: 2, ayah: 157 },
      { surah: 3, ayah: 139 },
      { surah: 9, ayah: 40 },
      { surah: 12, ayah: 86 },
    ],
    starter: 'I’m carrying a lot of sadness right now. How can the Qur’an comfort me?',
  },
  {
    id: 'hope',
    title: 'Hope when you despair',
    emoji: '🌅',
    blurb: 'When it feels too dark',
    intro:
      'However far you feel, His mercy reaches further. No darkness is beyond the dawn He can bring — and your life is precious.',
    verses: [
      { surah: 39, ayah: 53 },
      { surah: 94, ayah: 5 },
      { surah: 94, ayah: 6 },
      { surah: 65, ayah: 3 },
      { surah: 21, ayah: 87 },
      { surah: 93, ayah: 3 },
    ],
    starter: 'I’ve been feeling hopeless. What does the Qur’an say about hope and God’s mercy?',
    crisis: true,
  },
  {
    id: 'patience',
    title: 'Patience in hardship',
    emoji: '⏳',
    blurb: 'When you’re asked to endure',
    intro:
      'Patience is not passivity — it’s holding on with trust. The Qur’an pairs every hardship with nearness and reward.',
    verses: [
      { surah: 2, ayah: 153 },
      { surah: 2, ayah: 155 },
      { surah: 3, ayah: 200 },
      { surah: 16, ayah: 127 },
      { surah: 103, ayah: 3 },
    ],
    starter: 'I’m struggling to stay patient through a hard time. What guidance does the Qur’an give?',
  },
  {
    id: 'gratitude',
    title: 'Gratitude',
    emoji: '🤲',
    blurb: 'Noticing the gifts',
    intro:
      'Gratitude opens the heart and, the Qur’an promises, invites more. Even the ability to be thankful is itself a gift.',
    verses: [
      { surah: 14, ayah: 7 },
      { surah: 2, ayah: 152 },
      { surah: 16, ayah: 18 },
      { surah: 55, ayah: 13 },
      { surah: 27, ayah: 40 },
    ],
    starter: 'How can I grow in gratitude to God?',
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness',
    emoji: '💛',
    blurb: 'Letting go, and being let go',
    intro:
      'To forgive is hard, and to be forgiven is a mercy. The Qur’an links the two — we pardon, hoping to be pardoned.',
    verses: [
      { surah: 24, ayah: 22 },
      { surah: 7, ayah: 199 },
      { surah: 42, ayah: 40 },
      { surah: 3, ayah: 134 },
      { surah: 39, ayah: 53 },
    ],
    starter: 'I’m finding it hard to forgive. What does the Qur’an teach about pardoning?',
  },
  {
    id: 'doubt',
    title: 'Doubt & questioning',
    emoji: '🌙',
    blurb: 'When faith feels uncertain',
    intro:
      'Questions are not the enemy of faith — the Qur’an invites reflection. It’s okay to wonder; many sincere hearts have.',
    verses: [
      { surah: 2, ayah: 286 },
      { surah: 3, ayah: 190 },
      { surah: 3, ayah: 191 },
      { surah: 41, ayah: 53 },
      { surah: 50, ayah: 16 },
    ],
    starter: 'I’ve been having doubts about faith. Can the Qur’an speak to that gently?',
  },
  {
    id: 'repentance',
    title: 'Turning back',
    emoji: '🌱',
    blurb: 'After you’ve slipped',
    intro:
      'However many times you fall, the door to return stays open. The Qur’an describes a Lord who loves those who turn back — without shame.',
    verses: [
      { surah: 39, ayah: 53 },
      { surah: 2, ayah: 222 },
      { surah: 66, ayah: 8 },
      { surah: 11, ayah: 114 },
      { surah: 4, ayah: 110 },
    ],
    starter: 'I keep slipping into the same mistakes. What does the Qur’an say about turning back to God?',
  },
  {
    id: 'loneliness',
    title: 'Loneliness',
    emoji: '🌟',
    blurb: 'When you feel alone',
    intro:
      'Even when no one is near, He is. The Qur’an describes a closeness nearer than we can imagine.',
    verses: [
      { surah: 2, ayah: 186 },
      { surah: 50, ayah: 16 },
      { surah: 93, ayah: 3 },
      { surah: 9, ayah: 40 },
    ],
    starter: 'I feel alone lately. Does the Qur’an speak to loneliness?',
  },
  {
    id: 'guidance',
    title: 'Feeling lost',
    emoji: '🧭',
    blurb: 'Seeking direction',
    intro:
      'When the path is unclear, the Qur’an’s first prayer is for guidance — and it promises a way out for those who turn to Him.',
    verses: [
      { surah: 1, ayah: 6 },
      { surah: 1, ayah: 7 },
      { surah: 2, ayah: 2 },
      { surah: 64, ayah: 11 },
      { surah: 65, ayah: 2 },
    ],
    starter: 'I feel lost and unsure of my direction. What does the Qur’an say about guidance?',
  },
];

export function getHub(id: string): Hub | undefined {
  return HUBS.find((h) => h.id === id);
}

// The daily mood check-in → a matching hub (only the moods with a clear fit route somewhere).
const MOOD_TO_HUB: Record<string, string> = {
  anxious: 'anxiety',
  low: 'grief',
  grateful: 'gratitude',
};
export function hubForMood(moodId: string): Hub | undefined {
  const id = MOOD_TO_HUB[moodId];
  return id ? getHub(id) : undefined;
}

// Onboarding "what you're carrying" focuses → hubs to surface for this person.
const FOCUS_TO_HUB: Record<string, string> = {
  anxiety: 'anxiety',
  hopelessness: 'hope',
  doubt: 'doubt',
  temptation: 'repentance',
  grief: 'grief',
  relationships: 'forgiveness',
};
export function hubsForFocuses(focuses: string[]): Hub[] {
  const ids = new Set(focuses.map((f) => FOCUS_TO_HUB[f]).filter(Boolean));
  return HUBS.filter((h) => ids.has(h.id));
}
