// suggested-questions.ts — tappable starter questions for the Ask tab (frame 21). When a user taps an
// Explore topic, a sheet offers a few good ways in; tapping one sends it straight into the grounded chat.
// Curated, gentle, on-topic. They are only PROMPTS — every answer still flows through the RAG pipeline
// (verses from the verified DB, citations validated, no AI-generated scripture).
// Keyed by hub id (see lib/hubs.ts): anxiety, grief, hope, patience, gratitude, forgiveness, doubt,
// repentance, loneliness, guidance.

export const SUGGESTED: Record<string, string[]> = {
  anxiety: [
    'I can’t stop worrying about the future — what does the Qur’an say?',
    'How do I find calm when my mind won’t settle?',
    'Which verses help most with fear and anxiety?',
    'How can I trust God with what I can’t control?',
  ],
  grief: [
    'I’m carrying a heavy sadness right now. How can the Qur’an comfort me?',
    'Is it okay to grieve as a believer?',
    'What does the Qur’an say about loss and reunion?',
    'How did the prophets cope with sorrow?',
  ],
  hope: [
    'I’ve been feeling hopeless. What does the Qur’an say about mercy?',
    'Can God forgive someone like me?',
    'Where can I find light when everything feels dark?',
    'What does the Qur’an promise after hardship?',
  ],
  patience: [
    'How do I stay patient through a long trial?',
    'What does sabr really mean in the Qur’an?',
    'Why does God test the people He loves?',
    'How did the prophets show patience?',
  ],
  gratitude: [
    'How can I become more grateful?',
    'What does the Qur’an say about shukr?',
    'How does gratitude change the heart?',
    'Which verses remind us of God’s blessings?',
  ],
  forgiveness: [
    'How do I forgive someone who hurt me?',
    'Does God forgive every sin?',
    'How do I forgive myself and move on?',
    'What does the Qur’an say about pardoning others?',
  ],
  doubt: [
    'I’m struggling with doubt about my faith. Is that normal?',
    'How do I deal with questions I can’t answer?',
    'What does the Qur’an say to a doubting heart?',
    'How can I find certainty again?',
  ],
  repentance: [
    'How do I turn back to God after sinning?',
    'What does sincere repentance look like?',
    'Will God accept me if I keep slipping?',
    'What does the Qur’an say about tawbah?',
  ],
  loneliness: [
    'I feel so alone — what does the Qur’an say?',
    'How can I feel God’s nearness when I’m isolated?',
    'Which verses comfort a lonely heart?',
    'How do I cope when no one seems to understand me?',
  ],
  guidance: [
    'I feel lost and unsure of my path — where do I start?',
    'How do I know what God wants from me?',
    'What does the Qur’an say about finding direction?',
    'How can I make a hard decision?',
  ],
};

// Generic starters for the welcome state (when no topic is chosen).
export const GENERAL_QUESTIONS: string[] = [
  'What does the Qur’an say about finding peace?',
  'Tell me about God’s mercy.',
  'How can I build a habit of reading the Qur’an?',
  'What is the meaning of Surah Al-Fatiha?',
  'How do I pray with more focus?',
  'Explain a verse that’s been on my mind.',
];

/** Suggested questions for a hub id, falling back to the general set. */
export function questionsFor(hubId: string): string[] {
  return SUGGESTED[hubId] ?? GENERAL_QUESTIONS;
}
