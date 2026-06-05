// A premium line-art emblem (MaterialCommunityIcons) per Journey — used in the seal medallion on the
// Journeys library cards and the detail hero, replacing the legacy emoji. Typed so tsc validates every
// glyph name. Keep it aniconic (objects/symbols, never figures).
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { PlanId } from './plans';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

export const PLAN_ICON: Record<PlanId, Glyph> = {
  'new-to-quran': 'sprout',
  'juz-amma': 'book-open-page-variant-outline',
  'understanding-salah': 'mosque',
  'through-hardship': 'weather-rainy',
  gratitude: 'leaf',
  'mercy-forgiveness': 'heart-outline',
  'the-hereafter': 'weather-sunset',
  'names-of-allah': 'star-crescent',
  'calling-on-allah': 'hands-pray',
  'stories-of-the-prophets': 'script-text-outline',
  'patience-trust': 'anchor',
  'good-character': 'handshake-outline',
  'contentment-provision': 'food-apple-outline',
  'parents-family': 'home-heart',
  'reflection-knowledge': 'telescope',
  remembrance: 'star-four-points-outline',
  'ramadan-fasting': 'moon-waning-crescent',
};

export function planIcon(id: string): Glyph {
  return PLAN_ICON[id as PlanId] ?? 'book-open-page-variant-outline';
}
