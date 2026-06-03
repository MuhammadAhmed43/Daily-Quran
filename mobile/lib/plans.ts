// "Journeys" — guided, hand-authored study-plan tracks: an ordered series of short daily steps
// through the Qur'an. Each step centers on 1–3 verses (referenced by surah:ayah and rendered from
// the bundled Qur'an DB at runtime — NEVER AI-generated scripture, same vetting bar as hubs.ts /
// stories.ts), with a short framing in the app's own voice and one reflection prompt. The deeper,
// tafsir-grounded explanation is reached by tapping a verse (the existing ExplainSheet), so this
// file carries no commentary of its own.
//
// Guardrails baked in: Sunni-mainstream and non-sectarian; no fatwas (the Salah track teaches the
// MEANING of prayer and defers the how-to to a scholar — never rules on validity); depiction-safe;
// and a dedicated crisis-care step (care:true) in "Through Hardship" that puts real help and a
// helpline before scripture. Progress lives separately in plan-progress.ts (mirrors watch /
// watch-progress). Verse choices & framings are hand-vetted — accuracy and pastoral fit matter.
import type { Ref } from './today';

export type PlanId = 'new-to-quran' | 'juz-amma' | 'understanding-salah' | 'through-hardship';

export type PlanStep = {
  order: number; // 1-based position within the track
  title: string;
  verses: Ref[]; // 1–3 verses — the heart of the step (empty only for a care step)
  framing: string; // 2–4 sentences of context, in the app voice (never scripture)
  reflection: string; // one open prompt to sit with — not graded, not stored
  note?: string; // optional gentle action or bridge (app voice)
  care?: true; // crisis-care step: help + helpline come first, no verse leads
};

export type PlanTrack = {
  id: PlanId;
  title: string;
  emoji: string; // a calm, aniconic glyph (object/symbol — never a figure)
  blurb: string; // one line for the list card
  intro: string; // framing on the overview screen
  accent: string; // per-track accent (works on light + dark)
  steps: PlanStep[];
};

const ref = (surah: number, ...ayahs: number[]): Ref[] => ayahs.map((ayah) => ({ surah, ayah }));

// ───────────────────────────── New to the Qur'an (7) ─────────────────────────────
const NEW_TO_QURAN: PlanTrack = {
  id: 'new-to-quran',
  title: 'New to the Qur’an',
  emoji: '🌱',
  blurb: 'Never opened it before? Start here.',
  intro:
    'A gentle first walk through the Qur’an — what it is, how it speaks, and how to begin a lasting relationship with it. No background needed; just an open heart and a few minutes a day.',
  accent: '#0a7ea4',
  steps: [
    {
      order: 1,
      title: 'What this Book is',
      verses: ref(2, 2),
      framing:
        'The Qur’an opens not with a demand but with an offer: guidance, for anyone willing to receive it. You don’t need to arrive as a scholar or a perfect person — only curious and open. Today is simply about beginning.',
      reflection: 'What made you want to open it today?',
    },
    {
      order: 2,
      title: 'The first word: “Read”',
      verses: ref(96, 1, 5),
      framing:
        'The very first revelation given to the Prophet ﷺ was a single command: “Read” — in the name of the One who created you and taught you what you did not know. From its first breath, this is a faith that asks you to seek, to learn, to pay attention.',
      reflection: 'What would it mean to read with your heart, not only your eyes?',
    },
    {
      order: 3,
      title: 'The Opening',
      verses: ref(1, 1, 2, 3, 4, 5, 6, 7),
      framing:
        'Al-Fātiḥa, “the Opening,” is the most-recited passage on earth — said in every prayer. In seven short verses it moves from praise, to mercy, to devotion, to the one request that holds everything: “Guide us to the straight path.” It is the whole relationship in miniature.',
      reflection: 'Which line of Al-Fātiḥa speaks to where you are right now?',
    },
    {
      order: 4,
      title: 'Meant to be understood',
      verses: ref(47, 24),
      framing:
        'Some treat the Qur’an as words only to be recited, not understood. Yet it asks the reader directly: “Will they not ponder the Quran? Or are there locks upon their hearts?” Its meaning was never meant to be locked away from ordinary people — it was meant to reach you.',
      reflection: 'What is one verse you’d like to truly understand, not just hear?',
    },
    {
      order: 5,
      title: 'Not sent to burden you',
      verses: ref(20, 2),
      framing:
        'If faith has ever felt like a weight, listen to how the Qur’an describes itself: not sent to cause you distress, but as a reminder for those who are receptive. It comes as relief and direction, not as a ledger of ways you fall short.',
      reflection: 'Where in life could you use that kind of gentle direction?',
    },
    {
      order: 6,
      title: 'A Book that moves the heart',
      verses: ref(39, 23),
      framing:
        'The Qur’an describes its own effect: skins tremble, then hearts soften toward the remembrance of God. You don’t have to manufacture that feeling — just keep showing up, and let the words do their quiet work over time.',
      reflection: 'When did words last move you deeply?',
    },
    {
      order: 7,
      title: 'How to keep going',
      verses: ref(73, 4),
      framing:
        'A relationship with the Qur’an is built slowly — a little each day, recited without rushing, returned to again and again. The goal was never to finish fast, but to keep coming back. You’ve already begun.',
      reflection: 'What small daily habit could you start with the Qur’an?',
      note: 'When you’re ready, the Juz ʿAmma journey is a natural next step — the short surahs, one at a time.',
    },
  ],
};

// ───────────────────────────── Juz ʿAmma (15) — An-Naba (78) → An-Nas (114) ─────────────────────────────
const JUZ_AMMA: PlanTrack = {
  id: 'juz-amma',
  title: 'Juz ʿAmma',
  emoji: '📖',
  blurb: 'The short surahs, one at a time.',
  intro:
    'A guided tour through the thirtieth part of the Qur’an — the short, vivid surahs that many memorize and pray with first. From An-Naba to An-Nas, one small step a day.',
  accent: '#4f9d69',
  steps: [
    {
      order: 1,
      title: 'The Great News',
      verses: ref(78, 1, 31),
      framing:
        'The final part of the Qur’an opens on the question people have always whispered about: what comes after all this? Sūrah an-Naba calls it “the great news,” and turns our eyes past the fear toward the triumph awaiting those who live mindfully.',
      reflection: 'What “great news” do you most need to hear right now?',
    },
    {
      order: 2,
      title: 'The soul that restrains itself',
      verses: ref(79, 40, 41),
      framing:
        'These early surahs keep returning to one honest moment: standing before our Lord. Sūrah an-Nāziʿāt names the way through — gently restraining the self from what harms it — and the garden of peace that follows.',
      reflection: 'What is one desire you’d like more mastery over?',
    },
    {
      order: 3,
      title: 'He frowned',
      verses: ref(80, 1, 2),
      framing:
        'In a striking moment, God gently corrects His own Prophet ﷺ for turning from a blind man who came sincerely seeking. The lesson is timeless: no earnest, humble heart is ever beneath attention — least of all the ones the world overlooks.',
      reflection: 'Who around you is sincerely seeking, and easily overlooked?',
    },
    {
      order: 4,
      title: 'What deceived you?',
      verses: ref(82, 6),
      framing:
        'As these surahs picture the sky splitting and the stars scattering, one tender question cuts through the awe: “O man! What deluded you concerning your Lord, the Most Generous?” It reads less like a threat than an invitation to come home.',
      reflection: 'What would you change if today were the last ordinary day?',
    },
    {
      order: 5,
      title: 'Honest scales',
      verses: ref(83, 1, 2, 3),
      framing:
        'Sūrah al-Muṭaffifīn warns those who demand full measure for themselves but shortchange others. It’s a reminder that faith shows up in the small, daily honesty of how we treat people when no one is checking.',
      reflection: 'Where are you tempted to “round in your own favor”?',
    },
    {
      order: 6,
      title: 'Toiling toward your Lord',
      verses: ref(84, 6),
      framing:
        '“O man! You are laboring towards your Lord, and you will meet Him.” Every effort, every hardship, every ordinary day is movement in a direction. The verse reframes a tiring life as a journey that arrives somewhere good.',
      reflection: 'What are you quietly laboring toward these days?',
    },
    {
      order: 7,
      title: 'Glory to the Most High',
      verses: ref(87, 1, 17),
      framing:
        'Sūrah al-Aʿlā lifts the gaze: glorify the name of your Lord, the Most High. And it names our oldest mistake plainly — we prefer the life right in front of us, “though the Hereafter is better and more lasting.”',
      reflection: 'When does the sky, or something vast, make you feel small in a good way?',
    },
    {
      order: 8,
      title: 'The tranquil soul',
      verses: ref(89, 27, 28),
      framing:
        'After pages of warning comes one of the tenderest calls in the Qur’an: “O tranquil soul, return to your Lord, pleased and accepted.” This is where the whole journey is meant to lead — a heart finally at rest.',
      reflection: 'What would a “tranquil soul” feel like for you?',
    },
    {
      order: 9,
      title: 'The soul, shaped two ways',
      verses: ref(91, 9, 10),
      framing:
        'Sūrah ash-Shams ends on a clear hinge: “Successful is he who purifies it,” and “failing is he who corrupts it.” The soul can be tended like a garden or left to weeds — and small daily choices are the tending.',
      reflection: 'What is one small thing that “purifies” your heart?',
    },
    {
      order: 10,
      title: 'He did not abandon you',
      verses: ref(93, 3, 5),
      framing:
        'Sūrah aḍ-Ḍuḥā came as comfort in a hard season: “Your Lord did not abandon you, nor did He forget,” and “your Lord will give you, and you will be satisfied.” Tenderness, exactly when it was needed most.',
      reflection: 'Recall a hard stretch that was quietly followed by relief.',
    },
    {
      order: 11,
      title: 'The best of forms',
      verses: ref(95, 4, 6),
      framing:
        '“We created man in the best design.” The dignity is built in — and the surah pairs it with the path that keeps it: faith and good deeds. You were made well; this journey is about living up to it.',
      reflection: 'How could you honor the gift of being well-made today?',
    },
    {
      order: 12,
      title: 'A night better than a thousand months',
      verses: ref(97, 1, 3),
      framing:
        'Sūrah al-Qadr marks the night the Qur’an began to descend — a single night “better than a thousand months.” It’s a glimpse of how God measures worth: not by length, but by what fills the time.',
      reflection: 'What would you ask for on a night better than a lifetime?',
    },
    {
      order: 13,
      title: 'Every atom counts',
      verses: ref(99, 7, 8),
      framing:
        '“Whoever has done an atom’s weight of good will see it, and whoever has done an atom’s weight of evil will see it.” Nothing good is ever too small to matter, and nothing is lost. It’s a quietly motivating way to look at an ordinary day.',
      reflection: 'What tiny good could you do that feels too small to count?',
    },
    {
      order: 14,
      title: 'What survives time',
      verses: ref(103, 1, 2, 3),
      framing:
        'Sūrah al-ʿAṣr is a whole worldview in three short verses: by time, humanity is in loss — except those who believe, do good, and counsel one another to truth and to patience. A pocket-sized compass for a life.',
      reflection: 'Of faith, good work, truth, and patience — which needs your attention most?',
    },
    {
      order: 15,
      title: 'Pure devotion and refuge',
      verses: [...ref(112, 1), ...ref(113, 1), ...ref(114, 1)],
      framing:
        'The juz — and the Qur’an — close on pure devotion and shelter: “He is God, the One,” and then two surahs of seeking refuge in Him from every harm, seen and unseen. These are the short surahs most people carry into their prayers first.',
      reflection: 'Saying “He is God, the One,” what does that steady in you?',
      note: 'You now know the surahs many use in daily prayer. The Understanding Salah journey explores what we’re really saying when we pray.',
    },
  ],
};

// ───────────────────────────── Understanding Salah (10) — the MEANING of prayer ─────────────────────────────
const UNDERSTANDING_SALAH: PlanTrack = {
  id: 'understanding-salah',
  title: 'Understanding Salah',
  emoji: '🕌',
  blurb: 'The meaning behind the prayer.',
  intro:
    'Prayer is meant to be a meeting, not a routine. This journey explores the meaning behind the salah — why we pray, what we’re saying, and how to bring the heart back into it. For the how-to of prayer, your local imam is the best guide.',
  accent: '#6b6fc4',
  steps: [
    {
      order: 1,
      title: 'Why we pray at all',
      verses: ref(20, 14),
      framing:
        '“Serve Me, and practice the prayer for My remembrance.” Beneath the motions, salah is a standing appointment with God woven into the day — a way to keep returning to Him before the world pulls us away again.',
      reflection: 'What do you most hope to feel when you stand to pray?',
    },
    {
      order: 2,
      title: 'More than washing the body',
      verses: ref(5, 6),
      framing:
        'The Qur’an frames the purification before prayer with a beautiful intention: God “does not intend to burden you, but… to purify you, and to complete His blessing upon you.” It is a moment of readiness — arriving clean, in body and attention. (For exactly how to perform wuḍūʾ, a teacher or your local imam can guide you.)',
      reflection: 'What would it feel like to arrive at prayer truly “ready”?',
    },
    {
      order: 3,
      title: 'The heart of the prayer',
      verses: ref(1, 2, 5),
      framing:
        'Every unit of prayer is built around Al-Fātiḥa. Its center is a turning point: “It is You we worship, and upon You we call for help.” In one line we set down our self-reliance and place everything in His hands.',
      reflection: 'When you say “You alone we ask,” what help is on your heart?',
    },
    {
      order: 4,
      title: 'A conversation, answered',
      verses: ref(1, 6),
      framing:
        'In a well-known sacred narration, God says He has “divided the prayer” between Himself and His servant — and that each line of Al-Fātiḥa is met with His response. The prayer is not a monologue into the air; it is a conversation that is heard.',
      reflection: 'Imagine each line being answered — how does that change your prayer?',
    },
    {
      order: 5,
      title: 'Standing in devotion',
      verses: ref(2, 238),
      framing:
        '“Stand before God in devotion.” Prayer begins with presence — choosing, for a few minutes, to be fully here rather than rushing through. The posture of the body is an invitation to the heart.',
      reflection: 'What helps you feel present rather than hurried?',
    },
    {
      order: 6,
      title: 'Prayer that humbles',
      verses: ref(23, 1, 2),
      framing:
        '“Successful are the believers — those who are humble in their prayers.” Khushūʿ, that quiet humility and focus, is the soul of salah. It’s not about perfect concentration, but about a heart that keeps softening and returning.',
      reflection: 'What pulls your attention away — and how might you gently return it?',
    },
    {
      order: 7,
      title: 'Not just going through the motions',
      verses: ref(107, 4, 5),
      framing:
        'The Qur’an cautions against those “who are heedless of their prayers” — present in body, absent in heart. Read it not as a verdict on anyone’s prayer, but as a loving nudge to bring the meaning back into the movements.',
      reflection: 'How could you guard the meaning of your prayer, not only its form?',
    },
    {
      order: 8,
      title: 'The nearness of prostration',
      verses: [...ref(96, 19), ...ref(50, 16)],
      framing:
        '“Kneel down, and come near.” In sujūd we are physically at our lowest and, the tradition teaches, spiritually closest — to a God who is “nearer to him than his jugular vein.” It is the most intimate moment of the prayer.',
      reflection: 'What would you whisper to God while closest to Him?',
    },
    {
      order: 9,
      title: 'Why these times',
      verses: ref(17, 78),
      framing:
        'Prayer is spread across the day — from the decline of the sun to the dark of night, and the dawn recitation that, the verse says, “is witnessed.” The rhythm is deliberate: remembrance keeps coming back around so the heart never drifts too far.',
      reflection: 'Which time of prayer feels most meaningful to you?',
    },
    {
      order: 10,
      title: 'Carrying the prayer with you',
      verses: ref(29, 45),
      framing:
        '“The prayer prevents indecencies and evils.” Its purpose was never to stay on the mat — a genuine prayer is meant to reshape the hours that follow it. The test of salah is the kind of person we are when we stand back up.',
      reflection: 'What is one way today’s prayer could change the next hour?',
    },
  ],
};

// ───────────────────────────── Through Hardship (10) — care before scripture ─────────────────────────────
const THROUGH_HARDSHIP: PlanTrack = {
  id: 'through-hardship',
  title: 'Through Hardship',
  emoji: '🤲',
  blurb: 'Mercy and steadiness for heavy days.',
  intro:
    'When life feels heavy, the Qur’an meets you with mercy before anything else. A gentle journey through patience, hope, reliance, and prayer — and, first, a reminder that real help matters and you don’t have to carry it alone.',
  accent: '#c2774f',
  steps: [
    {
      order: 1,
      title: 'You’re carrying something heavy',
      verses: ref(94, 1),
      framing:
        'Naming pain is allowed here. The Qur’an speaks tenderly to the Prophet ﷺ in his own distress — “Did We not soothe your heart?” — acknowledging the weight before offering relief. Your heaviness is seen.',
      reflection: 'What is the heaviest thing you’re carrying right now?',
    },
    {
      order: 2,
      title: 'You’re not alone — reaching out comes first',
      verses: [],
      care: true,
      framing:
        'Before any verse: if you are in crisis or thinking about harming yourself, please reach out to someone right now — a trusted person, or your local emergency services or a crisis helpline. Scripture is a comfort, but it is not a substitute for real, human help. Reaching out is strength, and there is no shame in it.',
      reflection: 'Who is one safe person you could reach out to today?',
    },
    {
      order: 3,
      title: 'A burden made bearable',
      verses: ref(2, 286),
      framing:
        '“God does not burden any soul beyond its capacity.” It can be hard to believe on the heaviest days, yet the verse continues into the very prayer for relief that so many have leaned on. Whatever you’re facing, you were not handed more than you can carry.',
      reflection: 'What strength have you found in yourself that once surprised you?',
    },
    {
      order: 4,
      title: 'Tested, and held',
      verses: ref(2, 153, 155),
      framing:
        'The Qur’an offers its anchor first — “God is with the steadfast” — and only then names the trial just as plainly — “We will certainly test you” — and that the comfort comes before the warning is no accident. Steadfastness here isn’t gritting your teeth alone; it’s being accompanied through it.',
      reflection: 'Where could you ask God to “be with” you this week?',
    },
    {
      order: 5,
      title: 'With hardship, ease',
      verses: ref(94, 5, 6),
      framing:
        'It is said twice, back to back: “With hardship comes ease.” Not after the hardship is forgotten, but woven into the very same season. The ease is on its way — and often it is already quietly arriving.',
      reflection: 'What small ease can you notice even now, in the middle of things?',
    },
    {
      order: 6,
      title: 'Never despair of mercy',
      verses: ref(39, 53),
      framing:
        '“Do not despair of God’s mercy, for God forgives all sins.” No mistake is too large, no grief too deep, to be met by His mercy. However far you feel you’ve drifted, the door is described as wide open.',
      reflection: 'What would it feel like to truly believe mercy is still open to you?',
    },
    {
      order: 7,
      title: 'Leaning your weight on God',
      verses: ref(65, 3),
      framing:
        '“Whoever relies on God—He will suffice him,” promises the verse, and He provides “from where he never expected.” Tawakkul is the quiet act of handing what you cannot control to the One who holds it all.',
      reflection: 'What are you trying to carry alone that you could hand over?',
    },
    {
      order: 8,
      title: 'Take your sorrow to the right place',
      verses: ref(12, 86),
      framing:
        'When grief overwhelmed the Prophet Yaʿqūb, he said, “I only complain of my grief and sorrow to God.” There is a place to pour out everything you feel — honestly, without performance — and it is the most receptive place there is.',
      reflection: 'What would you say to God if you held nothing back?',
    },
    {
      order: 9,
      title: 'He answers when you call',
      verses: [...ref(40, 60), ...ref(2, 186)],
      framing:
        '“Pray to Me, and I will respond to you.” And elsewhere, with breathtaking closeness: “I Am near; I answer the call of the caller when he calls on Me.” Prayer is never shouting across a distance; it’s speaking to the One already beside you.',
      reflection: 'What is the one duʿāʾ your heart keeps returning to?',
    },
    {
      order: 10,
      title: 'The prayer in the dark',
      verses: [...ref(21, 87), ...ref(13, 28)],
      framing:
        'From the depths of the dark, Yūnus cried out: “There is no god but You! Glory to You! I was one of the wrongdoers!” — and he was answered. And the Qur’an tells us where that peace finally settles: “it is in the remembrance of God that hearts find comfort.” Even the darkest moment has a way out.',
      reflection: 'What words could become your own “prayer in the dark”?',
    },
  ],
};

export const PLANS: PlanTrack[] = [
  NEW_TO_QURAN,
  JUZ_AMMA,
  UNDERSTANDING_SALAH,
  THROUGH_HARDSHIP,
];

// ───────────────────────────── lookups (mirror watch.ts getChapter / neighbors) ─────────────────────────────
export function getPlan(id: string): PlanTrack | undefined {
  return PLANS.find((p) => p.id === id);
}
export function getStep(id: string, order: number): PlanStep | undefined {
  return getPlan(id)?.steps.find((s) => s.order === order);
}
export function planLength(id: string): number {
  return getPlan(id)?.steps.length ?? 0;
}
export function planAccent(id: string): string {
  return getPlan(id)?.accent ?? '#0a7ea4';
}

// Onboarding goals/focuses/knowledge → a suggested first journey (mirrors hubs' focus seeding).
// Canonical ids per profile.ts: goals 'prayer'|'hifz'…, focuses 'grief'|'hopelessness'|'anxiety'…
const GOAL_TO_PLAN: Record<string, PlanId> = {
  prayer: 'understanding-salah',
  hifz: 'juz-amma',
};
const FOCUS_TO_PLAN: Record<string, PlanId> = {
  grief: 'through-hardship',
  hopelessness: 'through-hardship',
  anxiety: 'through-hardship',
};
const KNOWLEDGE_TO_PLAN: Record<string, PlanId> = {
  new: 'new-to-quran',
  some: 'juz-amma',
};

/** A single suggested track for this person — goal first, then focus, then knowledge, else the gentlest default. */
export function suggestedPlan(p: { goals: string[]; focuses: string[]; knowledge: string }): PlanId {
  for (const g of p.goals) if (GOAL_TO_PLAN[g]) return GOAL_TO_PLAN[g];
  for (const f of p.focuses) if (FOCUS_TO_PLAN[f]) return FOCUS_TO_PLAN[f];
  return KNOWLEDGE_TO_PLAN[p.knowledge] ?? 'new-to-quran';
}
