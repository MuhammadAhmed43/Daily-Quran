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

export type PlanId =
  | 'new-to-quran'
  | 'juz-amma'
  | 'understanding-salah'
  | 'through-hardship'
  | 'gratitude'
  | 'mercy-forgiveness'
  | 'the-hereafter'
  | 'names-of-allah'
  | 'calling-on-allah'
  | 'stories-of-the-prophets'
  | 'patience-trust';

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
        'The Qur’an describes its own effect: skins tremble, then hearts soften toward the remembrance of Allah. You don’t have to manufacture that feeling — just keep showing up, and let the words do their quiet work over time.',
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
        'In a striking moment, Allah gently corrects His own Prophet ﷺ for turning from a blind man who came sincerely seeking. The lesson is timeless: no earnest, humble heart is ever beneath attention — least of all the ones the world overlooks.',
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
        'Sūrah al-Qadr marks the night the Qur’an began to descend — a single night “better than a thousand months.” It’s a glimpse of how Allah measures worth: not by length, but by what fills the time.',
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
        'The juz — and the Qur’an — close on pure devotion and shelter: “He is Allah, the One,” and then two surahs of seeking refuge in Him from every harm, seen and unseen. These are the short surahs most people carry into their prayers first.',
      reflection: 'Saying “He is Allah, the One,” what does that steady in you?',
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
        '“Serve Me, and practice the prayer for My remembrance.” Beneath the motions, salah is a standing appointment with Allah woven into the day — a way to keep returning to Him before the world pulls us away again.',
      reflection: 'What do you most hope to feel when you stand to pray?',
    },
    {
      order: 2,
      title: 'More than washing the body',
      verses: ref(5, 6),
      framing:
        'The Qur’an frames the purification before prayer with a beautiful intention: Allah “does not intend to burden you, but… to purify you, and to complete His blessing upon you.” It is a moment of readiness — arriving clean, in body and attention. (For exactly how to perform wuḍūʾ, a teacher or your local imam can guide you.)',
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
        'In a well-known sacred narration, Allah says He has “divided the prayer” between Himself and His servant — and that each line of Al-Fātiḥa is met with His response. The prayer is not a monologue into the air; it is a conversation that is heard.',
      reflection: 'Imagine each line being answered — how does that change your prayer?',
    },
    {
      order: 5,
      title: 'Standing in devotion',
      verses: ref(2, 238),
      framing:
        '“Stand before Allah in devotion.” Prayer begins with presence — choosing, for a few minutes, to be fully here rather than rushing through. The posture of the body is an invitation to the heart.',
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
        '“Kneel down, and come near.” In sujūd we are physically at our lowest and, the tradition teaches, spiritually closest — to a Allah who is “nearer to him than his jugular vein.” It is the most intimate moment of the prayer.',
      reflection: 'What would you whisper to Allah while closest to Him?',
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
        '“Allah does not burden any soul beyond its capacity.” It can be hard to believe on the heaviest days, yet the verse continues into the very prayer for relief that so many have leaned on. Whatever you’re facing, you were not handed more than you can carry.',
      reflection: 'What strength have you found in yourself that once surprised you?',
    },
    {
      order: 4,
      title: 'Tested, and held',
      verses: ref(2, 153, 155),
      framing:
        'The Qur’an offers its anchor first — “Allah is with the steadfast” — and only then names the trial just as plainly — “We will certainly test you” — and that the comfort comes before the warning is no accident. Steadfastness here isn’t gritting your teeth alone; it’s being accompanied through it.',
      reflection: 'Where could you ask Allah to “be with” you this week?',
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
        '“Do not despair of Allah’s mercy, for Allah forgives all sins.” No mistake is too large, no grief too deep, to be met by His mercy. However far you feel you’ve drifted, the door is described as wide open.',
      reflection: 'What would it feel like to truly believe mercy is still open to you?',
    },
    {
      order: 7,
      title: 'Leaning your weight on Allah',
      verses: ref(65, 3),
      framing:
        '“Whoever relies on Allah—He will suffice him,” promises the verse, and He provides “from where he never expected.” Tawakkul is the quiet act of handing what you cannot control to the One who holds it all.',
      reflection: 'What are you trying to carry alone that you could hand over?',
    },
    {
      order: 8,
      title: 'Take your sorrow to the right place',
      verses: ref(12, 86),
      framing:
        'When grief overwhelmed the Prophet Yaʿqūb, he said, “I only complain of my grief and sorrow to Allah.” There is a place to pour out everything you feel — honestly, without performance — and it is the most receptive place there is.',
      reflection: 'What would you say to Allah if you held nothing back?',
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
        'From the depths of the dark, Yūnus cried out: “There is no god but You! Glory to You! I was one of the wrongdoers!” — and he was answered. And the Qur’an tells us where that peace finally settles: “it is in the remembrance of Allah that hearts find comfort.” Even the darkest moment has a way out.',
      reflection: 'What words could become your own “prayer in the dark”?',
    },
  ],
};

// ───────────────────────────── Gratitude (7) — shukr ─────────────────────────────
const GRATITUDE: PlanTrack = {
  id: 'gratitude',
  title: 'Gratitude',
  emoji: '🌾',
  blurb: 'Learning to see, name, and return thanks.',
  intro:
    'A gentle journey into shukr — learning to see, name, and return thanks for the countless gifts that fill an ordinary day, and how gratitude itself becomes a doorway to more.',
  accent: '#3f9d7a',
  steps: [
    {
      order: 1,
      title: 'Remember Me, and I will remember you',
      verses: ref(2, 152),
      framing:
        'The Qur’an offers a simple, staggering exchange: “So remember Me; I will remember you. And be grateful to Me and do not deny Me.” Gratitude here is not a chore but a relationship — the heart turning back toward the One who never forgets you.',
      reflection: 'What is one gift you’ve stopped noticing because it has always been there?',
    },
    {
      order: 2,
      title: 'Gratitude multiplies the gift',
      verses: ref(14, 7),
      framing:
        '“If you are grateful, I will surely increase you.” Thankfulness is described not as the end of a blessing but the beginning of more — a posture that opens the hand to receive. The increase is often not in things, but in contentment, in light, in the capacity to notice.',
      reflection: 'Where could a more grateful eye change how today feels?',
    },
    {
      order: 3,
      title: 'Blessings beyond counting',
      verses: ref(16, 18),
      framing:
        '“If you should count the favors of Allah, you could not enumerate them.” Every breath, the quiet working of a body you rarely think about, the people who love you — the list runs past the horizon. Gratitude begins by admitting we could never finish the accounting.',
      reflection: 'Name three favors you have never once thanked Allah for.',
    },
    {
      order: 4,
      title: 'Gratitude is for your own soul',
      verses: ref(31, 12),
      framing:
        'Luqman the wise is taught: “Be grateful to Allah. And whoever is grateful is grateful for [the good of] himself.” Allah is not enriched by our thanks nor diminished by our forgetting — gratitude is a gift we give ourselves, a way of staying soft and awake.',
      reflection: 'How does ingratitude slowly harden a person over time?',
    },
    {
      order: 5,
      title: 'A test wrapped in a blessing',
      verses: ref(27, 40),
      framing:
        'When a great favor arrives, a righteous servant says: “This is from the favor of my Lord to test me — whether I will be grateful or ungrateful.” Every gift is also a question: what will you do with it? Gratitude is how we pass the test of good fortune.',
      reflection: 'What blessing in your life is quietly asking, “now what will you do with me?”',
    },
    {
      order: 6,
      title: 'Which of His favors?',
      verses: ref(55, 13),
      framing:
        'Through Surah ar-Raḥmān runs one refrain, repeated until it echoes: “So which of the favors of your Lord would you deny?” It is asked of all creation — and of you — not as accusation but as an invitation to look again, and again, at how held you truly are.',
      reflection: 'Read that line slowly. What rises in you when you cannot, honestly, name a single favor to deny?',
    },
    {
      order: 7,
      title: 'Thankful at the table',
      verses: ref(2, 172),
      framing:
        '“O you who believe, eat from the good things We have provided for you and be grateful to Allah.” Gratitude is not only for grand moments; it lives in the ordinary — a meal, a glass of water, a full stomach — turning the smallest daily acts into worship.',
      reflection: 'What everyday habit could you turn into a small moment of thanks?',
      note: 'A grateful heart and a remembering tongue go together — the Beautiful Names of Allah journey is a way to keep remembering Him by who He is.',
    },
  ],
};

// ───────────────────────────── Mercy & Forgiveness (8) — raḥma & tawba ─────────────────────────────
const MERCY_FORGIVENESS: PlanTrack = {
  id: 'mercy-forgiveness',
  title: 'Mercy & Forgiveness',
  emoji: '🌿',
  blurb: 'The door of repentance never closes.',
  intro:
    'For anyone weighed down by guilt, or struggling to forgive — a journey through the vast mercy of Allah, the door of repentance that never closes, and the quiet freedom of letting go.',
  accent: '#5b86c4',
  steps: [
    {
      order: 1,
      title: 'Never despair of mercy',
      verses: ref(39, 53),
      framing:
        '“O My servants who have transgressed against themselves, do not despair of the mercy of Allah. Indeed, Allah forgives all sins.” However far you feel you have gone, the verse still calls you “My servant” — the bond is not severed. No sin is bigger than His forgiveness.',
      reflection: 'What have you been carrying that this verse invites you to set down?',
    },
    {
      order: 2,
      title: 'A mercy that encompasses everything',
      verses: ref(7, 156),
      framing:
        'Allah describes His own mercy: “My mercy encompasses all things.” It is not a reluctant, measured mercy but one that surrounds creation the way the sky surrounds the earth. You are never outside of it.',
      reflection: 'Where in your life do you most need to feel surrounded by mercy?',
    },
    {
      order: 3,
      title: 'He turns to those who turn to Him',
      verses: ref(42, 25),
      framing:
        '“It is He who accepts repentance from His servants, and pardons the misdeeds, and knows what you do.” Repentance is not Allah reluctantly tolerating your return — He names Himself at-Tawwāb, the One who turns toward whoever turns to Him. The turning back is met, every time.',
      reflection: 'How would it change repentance to believe He turns toward you as you turn to Him?',
    },
    {
      order: 4,
      title: 'The turning that cleanses',
      verses: ref(66, 8),
      framing:
        '“O you who have believed, repent to Allah with sincere repentance.” Sincere repentance (tawba naṣūḥ) is a turning of the whole self — regret for the past, leaving it in the present, and resolve for the future. It is less a transaction than a homecoming.',
      reflection: 'What would a sincere, whole-hearted turning look like for you right now?',
    },
    {
      order: 5,
      title: 'Remembering Him in the stumble',
      verses: ref(3, 135),
      framing:
        'The righteous are described as “those who, when they commit an immorality or wrong themselves, remember Allah and seek forgiveness — and who can forgive sins except Allah?” Righteousness here is not never falling; it is Whom you turn to when you do.',
      reflection: 'When you slip, where does your mind go first?',
    },
    {
      order: 6,
      title: 'Forgiving as you hope to be forgiven',
      verses: ref(24, 22),
      framing:
        'After a painful betrayal within the community, the believers are urged: “Let them pardon and overlook. Would you not love that Allah should forgive you?” Our own longing to be forgiven becomes the very reason to forgive others.',
      reflection: 'Who are you being asked to pardon — and what is holding on costing you?',
    },
    {
      order: 7,
      title: 'Evil deeds turned to good',
      verses: ref(25, 70),
      framing:
        'For the one who repents and believes and does righteousness, the promise is breathtaking: “for them Allah will replace their evil deeds with good ones.” Not merely erased — transformed. A past you regret can become the very ground of your turning toward Him.',
      reflection: 'How might your hardest chapter become a source of good?',
    },
    {
      order: 8,
      title: 'Good deeds wash away the bad',
      verses: ref(11, 114),
      framing:
        '“Indeed, good deeds do away with misdeeds.” Alongside repentance, the Qur’an offers an ongoing mercy: a kind word, a prayer, a quiet charity — small lights that dissolve old shadows. You are never without a way back.',
      reflection: 'What good, however small, could you offer today as a step back toward Him?',
      note: 'When the heart is light again, it is ready to call on Him freely — the Calling on Allah journey is a natural next step.',
    },
  ],
};

// ───────────────────────────── The Hereafter (8) — ākhira & perspective ─────────────────────────────
const THE_HEREAFTER: PlanTrack = {
  id: 'the-hereafter',
  title: 'The Hereafter',
  emoji: '🌅',
  blurb: 'Putting this world in its true proportion.',
  intro:
    'A journey to lift the gaze — putting this restless world in its true proportion against the life that lasts. Not to fear the end, but to live now with clarity, lightness, and purpose.',
  accent: '#9d7fc4',
  steps: [
    {
      order: 1,
      title: 'Every soul will taste death',
      verses: ref(3, 185),
      framing:
        '“Every soul will taste death. And you will only be given your full compensation on the Day of Resurrection… And what is the life of this world except the enjoyment of delusion?” The verse is not morbid; it is clarifying — naming what is temporary so we stop mistaking it for everything.',
      reflection: 'If you truly held that this life is brief, what would you worry about less?',
    },
    {
      order: 2,
      title: 'The real life is the next',
      verses: ref(29, 64),
      framing:
        '“And this worldly life is not but diversion and amusement. And indeed, the home of the Hereafter — that is the [eternal] life, if only they knew.” This world is a passing game; the lasting home is elsewhere. Knowing it reframes every gain and loss.',
      reflection: 'What “game” have you been taking as deadly serious lately?',
    },
    {
      order: 3,
      title: 'Play, adornment, and rivalry',
      verses: ref(57, 20),
      framing:
        'The Qur’an names the pattern of worldly life plainly — play and amusement, adornment, boasting, and competition in wealth and children — like a crop that delights, then withers. It does not forbid the world; it asks us not to be fooled by it.',
      reflection: 'Which of those — status, appearance, rivalry — pulls hardest on you?',
    },
    {
      order: 4,
      title: 'Until you visit the graves',
      verses: ref(102, 1, 2),
      framing:
        '“Competition in [worldly] increase diverts you, until you visit the graveyards.” A short, piercing sūrah: we chase more and more, distracted, until the chase ends at the cemetery gate — a gentle wake-up, delivered while there is still time.',
      reflection: 'What are you accumulating that will not matter at that gate?',
    },
    {
      order: 5,
      title: 'Made to be tested',
      verses: ref(67, 2),
      framing:
        '“[He] who created death and life to test you as to which of you is best in deed.” Life is not random; it has a shape and a purpose — a testing ground where character is formed. Death is not the enemy of meaning, but part of its frame.',
      reflection: '“Best in deed,” not most in deed — how does quality over quantity change your day?',
    },
    {
      order: 6,
      title: 'What endures',
      verses: ref(18, 46),
      framing:
        '“Wealth and children are the adornment of worldly life, but the enduring good deeds are better with your Lord for reward and better for hope.” The things we love are not condemned — they are simply set below the deeds that outlast them.',
      reflection: 'What is one “enduring good” you could invest in today?',
    },
    {
      order: 7,
      title: 'Hasten to forgiveness and a garden',
      verses: ref(3, 133),
      framing:
        '“And hasten to forgiveness from your Lord and a garden as wide as the heavens and the earth, prepared for the righteous.” The gaze finally lifts to the goal: not just escaping loss, but racing toward a mercy and a home beyond imagining.',
      reflection: 'What would it mean to “hasten” — to move toward Allah with some urgency this week?',
    },
    {
      order: 8,
      title: 'More than they could wish',
      verses: ref(50, 35),
      framing:
        'Of that home, Allah says: “They will have whatever they wish therein, and with Us is more.” Every longing this world could not satisfy finds its answer there — and then more, beyond the asking. The Hereafter is not less than this life; it is the fullness this life only hinted at.',
      reflection: 'What deep longing do you carry that only something eternal could fill?',
    },
  ],
};

// ───────────────────────────── The Beautiful Names of Allah (7) — al-asmāʾ al-ḥusnā ─────────────────────────────
const NAMES_OF_ALLAH: PlanTrack = {
  id: 'names-of-allah',
  title: 'The Names of Allah',
  emoji: '✨',
  blurb: 'To know Him is to love Him.',
  intro:
    'To know Allah is to love Him. A gentle walk through some of the most beautiful names by which the Qur’an teaches us to know our Lord — and to call on Him by who He is.',
  accent: '#c8a24a',
  steps: [
    {
      order: 1,
      title: 'Call on Him by His beautiful names',
      verses: ref(7, 180),
      framing:
        '“And to Allah belong the best names, so invoke Him by them.” We are not left to guess who Allah is — He introduces Himself, and invites us to call on Him by the very qualities we most need: the Forgiving when we stumble, the Provider when we worry, the Near when we ache.',
      reflection: 'Which quality of Allah do you most need to lean on right now?',
    },
    {
      order: 2,
      title: 'The Most Merciful, Lord of all',
      verses: ref(1, 1, 2, 3),
      framing:
        'The Qur’an opens by naming Him: “In the name of Allah, the Entirely Merciful (ar-Raḥmān), the Especially Merciful (ar-Raḥīm)… Lord of all the worlds.” Before anything else is said, mercy is named twice — the first thing He wants us to know about Him.',
      reflection: 'What changes when the first word you associate with Allah is mercy?',
    },
    {
      order: 3,
      title: 'The Living, the Sustainer',
      verses: ref(2, 255),
      framing:
        'In Āyat al-Kursī: “Allah — there is no deity except Him, the Ever-Living (al-Ḥayy), the Sustainer of all existence (al-Qayyūm). Neither drowsiness overtakes Him nor sleep.” He does not tire, does not look away, does not need rest from holding the universe — or from holding you.',
      reflection: 'How does it feel to be sustained by One who never sleeps?',
    },
    {
      order: 4,
      title: 'Knower of the unseen, the Merciful',
      verses: ref(59, 22),
      framing:
        '“He is Allah, other than whom there is no deity, Knower of the unseen and the witnessed. He is the Entirely Merciful, the Especially Merciful.” He sees what no one else sees — your hidden efforts, your private grief — and meets it all with mercy.',
      reflection: 'What unseen thing about you would you want met with mercy?',
    },
    {
      order: 5,
      title: 'The King, the Source of Peace',
      verses: ref(59, 23),
      framing:
        '“He is the Sovereign (al-Malik), the Pure (al-Quddūs), the Source of Peace (as-Salām), the Granter of Security, the Guardian, the Almighty, the Compeller, the Supreme.” A cascade of names — and among them, as-Salām: from Him alone comes the peace the heart keeps chasing elsewhere.',
      reflection: 'Where are you seeking peace that only its true Source can give?',
    },
    {
      order: 6,
      title: 'The Creator, the Fashioner',
      verses: ref(59, 24),
      framing:
        '“He is Allah, the Creator (al-Khāliq), the Inventor (al-Bāriʾ), the Fashioner (al-Muṣawwir); to Him belong the best names.” The One who shaped every form shaped you — deliberately. Not mass-produced, but fashioned, named, intended.',
      reflection: 'What would change if you truly believed you were fashioned on purpose?',
    },
    {
      order: 7,
      title: 'Say: He is One',
      verses: ref(112, 1, 2, 3, 4),
      framing:
        '“Say, He is Allah, One (al-Aḥad); Allah, the Eternal Refuge (aṣ-Ṣamad); He neither begets nor is born, nor is there any equal to Him.” The heart of belief in four short lines: He is utterly One — the One everything leans on, while He leans on nothing.',
      reflection: 'What does it steady in you to say, and mean, “He is One”?',
      note: 'Now that you know some of His names, the Calling on Allah journey shows how to call on Him by them.',
    },
  ],
};

// ───────────────────────────── Calling on Allah (7) — duʿāʾ ─────────────────────────────
const CALLING_ON_ALLAH: PlanTrack = {
  id: 'calling-on-allah',
  title: 'Calling on Allah',
  emoji: '🤲',
  blurb: 'The believer’s quiet, always-open line.',
  intro:
    'Duʿāʾ is the believer’s quiet superpower — a direct line, always open. A journey through how the Qur’an teaches us to ask, and through the beautiful supplications the prophets themselves prayed.',
  accent: '#5a9d8f',
  steps: [
    {
      order: 1,
      title: 'Call on Him, humbly and in private',
      verses: ref(7, 55),
      framing:
        '“Call upon your Lord in humility and privately.” Duʿāʾ has a posture: lowered, sincere, unhurried — not a performance, but the honest reaching of a small servant toward a vast, attentive Lord.',
      reflection: 'When you pray, are you performing or reaching? What helps you be real?',
    },
    {
      order: 2,
      title: 'I am near — I respond',
      verses: ref(2, 186),
      framing:
        '“And when My servants ask you concerning Me — indeed I am near. I respond to the call of the caller when he calls upon Me.” There is no distance to shout across; He is near, and the answering is promised. The only question is whether we will call.',
      reflection: 'What have you been hesitating to ask Him for?',
    },
    {
      order: 3,
      title: 'The prayer of Ayyūb',
      verses: ref(21, 83, 84),
      framing:
        'Tested with the loss of nearly everything, the Prophet Ayyūb did not demand — he simply named his pain and his Lord’s nature: “Indeed, adversity has touched me, and You are the most merciful of the merciful.” And the response: “So We answered him and removed his affliction.”',
      reflection: 'Could you bring Allah your pain that plainly, without performance?',
    },
    {
      order: 4,
      title: 'The prayer of Mūsā',
      verses: ref(20, 25, 26, 27, 28),
      framing:
        'Sent to confront a tyrant, Mūsā asked not for power but for capacity: “My Lord, expand for me my chest, and ease for me my task, and untie the knot from my tongue, that they may understand my speech.” A duʿāʾ for anyone facing something bigger than themselves.',
      reflection: 'What “task” in your life needs this exact prayer?',
    },
    {
      order: 5,
      title: 'A prayer for those we love',
      verses: ref(25, 74),
      framing:
        'Among the servants of the Most Merciful are those who pray: “Our Lord, grant us from among our spouses and offspring comfort to our eyes, and make us a leader for the righteous.” A duʿāʾ that turns our love for family into worship.',
      reflection: 'Who would you name in this prayer tonight?',
    },
    {
      order: 6,
      title: 'Good in both worlds',
      verses: ref(2, 201),
      framing:
        'The Qur’an gives a perfectly balanced duʿāʾ: “Our Lord, give us in this world that which is good and in the Hereafter that which is good, and protect us from the punishment of the Fire.” It refuses to choose between this life and the next — it asks for the good of both.',
      reflection: 'What “good in this world” and “good in the next” would you ask for?',
    },
    {
      order: 7,
      title: 'Forgive, and have mercy',
      verses: ref(23, 118),
      framing:
        'The Qur’an even teaches us how to close: “My Lord, forgive and have mercy, and You are the best of the merciful.” We end where we began — leaning on His mercy, certain that the One we call is the most merciful there is.',
      reflection: 'Sit with one duʿāʾ you want to keep returning to. What is it?',
    },
  ],
};

// ───────────────────────────── Stories of the Prophets (9) — lessons from the messengers ─────────────────────────────
const STORIES_OF_THE_PROPHETS: PlanTrack = {
  id: 'stories-of-the-prophets',
  title: 'Stories of the Prophets',
  emoji: '🌟',
  blurb: 'Lessons from the lives of the messengers.',
  intro:
    'The Qur’an tells the stories of the prophets not as distant history, but as a mirror and a map. A journey through their lives — and the single lesson each one leaves for the road we are walking now.',
  accent: '#c8923f',
  steps: [
    {
      order: 1,
      title: 'Adam — the first to turn back',
      verses: ref(7, 23),
      framing:
        'The first human was also the first to slip — and the first to return. Adam and his wife prayed: “Our Lord, we have wronged ourselves; if You do not forgive us and have mercy on us, we will surely be among the losers.” The story of humanity begins not with a perfect record, but with a sincere turning back.',
      reflection: 'When you slip, can you turn back as openly as Adam did?',
    },
    {
      order: 2,
      title: 'Nuh — patience across a lifetime',
      verses: ref(29, 14),
      framing:
        'Nuh called his people to Allah for nearly a thousand years, met mostly with rejection — and still he did not stop. His is a story of patience stretched across a lifetime: doing what is right, faithfully, without ever seeing the result he hoped for.',
      reflection: 'Where are you being asked to persevere without a quick reward?',
    },
    {
      order: 3,
      title: 'Ibrahim — cool in the fire',
      verses: ref(21, 69),
      framing:
        'Thrown into a fire for standing against his people’s idols, Ibrahim was saved by a single command: “O fire, be coolness and safety upon Abraham.” When you stand for the truth and everything feels like flames, the same Lord can make them cool.',
      reflection: 'What “fire” are you afraid to walk into for the sake of what is right?',
    },
    {
      order: 4,
      title: 'Yusuf — the long road had a meaning',
      verses: ref(12, 90),
      framing:
        'Betrayed, enslaved, imprisoned — and finally raised to honor, Yusuf summed up his whole journey in one line: “Whoever is mindful of Allah and patient — Allah does not let the reward of the doers of good go to waste.” The hard road had a meaning all along.',
      reflection: 'Looking back, where can you see a hard road that was quietly leading somewhere good?',
    },
    {
      order: 5,
      title: 'Musa — a small, honest prayer',
      verses: ref(28, 24),
      framing:
        'Fleeing for his life, exhausted and alone in a strange land, Musa sat in the shade and made a small, honest prayer: “My Lord, I am truly in need of whatever good You send me.” From that low moment came shelter, work, and eventually prophethood. No duʿāʾ is too small or too desperate.',
      reflection: 'Could you make Musa’s prayer your own today?',
    },
    {
      order: 6,
      title: 'Ayyub — patient, and still turning to Him',
      verses: ref(38, 44),
      framing:
        'After losing his health, his wealth, and his family, the Prophet Ayyub is remembered by Allah with words anyone would long to hear: “We found him patient. What an excellent servant! He was ever turning back to Us.” His patience was not silence — it was staying turned toward Allah through all of it.',
      reflection: 'What would “patient, and still turning toward Allah” look like in your hardest area?',
    },
    {
      order: 7,
      title: 'Isa — the honor of being a servant',
      verses: ref(19, 30),
      framing:
        'As a newborn, by Allah’s leave, Isa spoke from the cradle to defend his mother: “I am the servant of Allah. He has given me the Scripture and made me a prophet.” Even one of the greatest of the prophets named himself first as a servant — the most honored title there is.',
      reflection: 'What does it mean to you that the prophets’ highest honor was simply to be Allah’s servant?',
    },
    {
      order: 8,
      title: 'Muhammad ﷺ — a mercy to the worlds',
      verses: ref(21, 107),
      framing:
        'Of the final Messenger ﷺ, Allah says simply: “We have not sent you except as a mercy to the worlds.” Not only to his people, not only to his time — a mercy meant for all people, everywhere, including you.',
      reflection: 'Where do you most need to feel that mercy reaching you?',
    },
    {
      order: 9,
      title: 'Their guidance is your map',
      verses: ref(6, 90),
      framing:
        'After recounting prophet after prophet, the Qur’an tells the Prophet ﷺ — and us: “Those are the ones Allah has guided, so follow their guidance.” Their stories are not just the past; they are a map, left for whoever wants to walk the same road home.',
      reflection: 'Which prophet’s example do you most want to carry with you?',
      note: 'You can sit with any of these stories more deeply in the Stories tab, where Yūsuf’s is told scene by scene.',
    },
  ],
};

// ───────────────────────────── Patience & Trust (7) — ṣabr & tawakkul ─────────────────────────────
const PATIENCE_TRUST: PlanTrack = {
  id: 'patience-trust',
  title: 'Patience & Trust',
  emoji: '🌧️',
  blurb: 'Steadiness and reliance for the long road.',
  intro:
    'Some seasons are not about a single hard blow, but a long, slow road. A journey through ṣabr (patience) and tawakkul (trust) — the two quiet strengths the Qur’an returns to again and again for exactly those stretches.',
  accent: '#5a8fa8',
  steps: [
    {
      order: 1,
      title: 'Two quiet sources of strength',
      verses: ref(2, 45),
      framing:
        '“Seek help through patience and prayer.” When the load is heavy, the Qur’an points to two quiet sources of strength — the steadiness to endure, and the prayer that keeps you connected to the One who can carry what you cannot.',
      reflection: 'When things get hard, which comes less naturally to you — patience, or turning to prayer?',
    },
    {
      order: 2,
      title: 'Patience is given, not just summoned',
      verses: ref(16, 127),
      framing:
        '“Be patient — and your patience is only through Allah.” Real patience is not gritted teeth and willpower alone; it is something Allah Himself supplies when you ask. You were never meant to be patient on your own strength.',
      reflection: 'Could you ask Allah for patience itself, the way you would ask for any other help?',
    },
    {
      order: 3,
      title: 'Do your part, then trust',
      verses: ref(3, 159),
      framing:
        '“Once you have made your decision, put your trust in Allah. Indeed, Allah loves those who trust in Him.” Tawakkul is not refusing to plan — it is planning, doing your part, and then handing the outcome to the One who controls it. And that handing-over is beloved to Him.',
      reflection: 'What decision are you gripping too tightly, afraid to entrust to Allah?',
    },
    {
      order: 4,
      title: 'Nothing reaches you but by His decree',
      verses: ref(9, 51),
      framing:
        '“Say: Nothing will ever befall us except what Allah has decreed for us; He is our Protector. And upon Allah let the believers rely.” Whatever comes, came with His knowledge and within His care. That certainty is the ground that trust stands on.',
      reflection: 'How would today feel, held inside “nothing reaches me except by His decree”?',
    },
    {
      order: 5,
      title: 'A reward without measure',
      verses: ref(39, 10),
      framing:
        '“The patient will be given their reward without measure.” Every other deed has a known return; patience alone is promised a reward beyond counting. The hardest, most thankless season may quietly be earning the most.',
      reflection: 'What patience of yours, unseen by anyone, might be worth more than you think?',
    },
    {
      order: 6,
      title: 'We belong to Him',
      verses: ref(2, 156),
      framing:
        'The steadfast are those who, when hardship strikes, say: “Indeed, we belong to Allah, and to Him we will return.” A single sentence that re-centers everything — we are His, on loan, heading home. It turns a moment of loss into a moment of remembrance.',
      reflection: 'What would it steady in you to truly say, “we belong to Allah”?',
    },
    {
      order: 7,
      title: 'Peace, at the end of the road',
      verses: ref(13, 24),
      framing:
        'The Qur’an pictures the angels greeting the patient in the Garden: “Peace be upon you for what you patiently endured. How excellent is the final home.” Every hard thing borne for Allah’s sake is seen, remembered, and answered — with peace, at the end of the road.',
      reflection: 'What hardship would you most want met, one day, with “peace be upon you for your patience”?',
    },
  ],
};

export const PLANS: PlanTrack[] = [
  NEW_TO_QURAN,
  JUZ_AMMA,
  UNDERSTANDING_SALAH,
  THROUGH_HARDSHIP,
  GRATITUDE,
  MERCY_FORGIVENESS,
  THE_HEREAFTER,
  NAMES_OF_ALLAH,
  CALLING_ON_ALLAH,
  STORIES_OF_THE_PROPHETS,
  PATIENCE_TRUST,
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
