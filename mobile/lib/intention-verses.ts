// The "intention -> a comforting ayah" index for the Ameen wall. The model only ever CLASSIFIES an
// intention into one of these themes (it returns a theme id, never any scripture); the verse refs
// below are hand-vetted and rendered from the bundled Qur'an by id. EVERY verse here must be purely
// COMFORTING - mercy, ease, nearness, hope, provision, du'a - never a warning or a hard verse, because
// the Ameen wall exists to comfort. Same vetting bar as hubs.ts / plans.ts; a human/scholar should
// bless the pairings.
import type { Ref } from './today';

export type IntentionTheme = {
  id: string;
  label: string; // shown to the user ("A prayer for healing")
  hint: string; // keywords for the classifier (server-side only, never shown)
  verses: Ref[]; // hand-vetted COMFORTING verses, rendered from the bundle by ref
};

const ref = (surah: number, ...ayahs: number[]): Ref[] => ayahs.map((ayah) => ({ surah, ayah }));

export const INTENTION_THEMES: IntentionTheme[] = [
  { id: 'healing', label: 'A prayer for healing', hint: 'illness, sickness, disease, recovery, surgery, hospital, health, unwell, pain, cure', verses: [...ref(26, 80), ...ref(21, 83)] },
  { id: 'parents', label: 'A prayer for your parents', hint: 'mother, father, parents, mom, dad, family elders, the people who raised me', verses: [...ref(17, 24), ...ref(46, 15)] },
  { id: 'grief', label: 'Comfort in grief', hint: 'death, passed away, died, deceased, late, grief, mourning, loss, funeral', verses: [...ref(2, 156), ...ref(2, 157), ...ref(13, 28)] },
  { id: 'anxiety', label: 'Calm for an anxious heart', hint: 'anxious, anxiety, worried, worry, scared, afraid, fear, overwhelmed, stress, panic, nervous', verses: [...ref(13, 28), ...ref(94, 5), ...ref(65, 3)] },
  { id: 'hardship', label: 'Strength through hardship', hint: 'hard time, hardship, struggle, difficulty, suffering, trial, going through, tough, exhausted, burden', verses: [...ref(94, 5), ...ref(2, 153), ...ref(13, 28)] },
  { id: 'guidance', label: 'A prayer for guidance', hint: 'lost, confused, decision, direction, unsure, which path, guidance, choice, crossroads', verses: [...ref(1, 6), ...ref(18, 10), ...ref(2, 186)] },
  { id: 'forgiveness', label: 'Hope in His mercy', hint: 'sin, mistake, forgive, forgiveness, repent, repentance, guilt, ashamed, regret, slipped, wrong', verses: [...ref(39, 53), ...ref(66, 8)] },
  { id: 'sustenance', label: 'Trust in your Provider', hint: 'job, work, money, rizq, provision, debt, poverty, financial, income, unemployed, bills', verses: [...ref(65, 3), ...ref(11, 6)] },
  { id: 'protection', label: 'A prayer for protection', hint: 'protect, protection, safety, safe, harm, danger, travel, journey, watch over, keep safe', verses: [...ref(41, 30), ...ref(3, 173)] },
  { id: 'marriage', label: 'A prayer for love and union', hint: 'marriage, spouse, husband, wife, partner, married, relationship, love, nikah, engagement', verses: [...ref(30, 21), ...ref(25, 74)] },
  { id: 'children', label: 'A prayer for children', hint: 'child, children, baby, pregnancy, conceive, offspring, kids, son, daughter, fertility', verses: [...ref(3, 38), ...ref(25, 74)] },
  { id: 'success', label: 'Ease for what lies ahead', hint: 'exam, test, study, school, university, success, goal, interview, project, deadline, results', verses: [...ref(20, 25), ...ref(20, 26), ...ref(94, 6)] },
  { id: 'ummah', label: 'A prayer for the ummah', hint: 'ummah, muslims, world, oppressed, palestine, gaza, suffering people, everyone, humanity, unity', verses: [...ref(59, 10), ...ref(49, 10)] },
  { id: 'gratitude', label: 'A heart of gratitude', hint: 'grateful, thankful, blessing, blessed, good news, happy, alhamdulillah, celebrate, joy', verses: [...ref(2, 152), ...ref(16, 18)] },
  { id: 'comfort', label: 'Peace and reassurance', hint: 'general comfort, trust, reliance, peace, reassurance, hope, anything else', verses: [...ref(13, 28), ...ref(2, 286), ...ref(94, 6)] },
];

export function themeById(id: string): IntentionTheme | undefined {
  return INTENTION_THEMES.find((t) => t.id === id);
}

// id + hint only, for the classifier endpoint (the verses stay client-side and are rendered locally).
export function classifierThemes(): { id: string; hint: string }[] {
  return INTENTION_THEMES.map((t) => ({ id: t.id, hint: t.hint }));
}
