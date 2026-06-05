// A line-icon per topical hub (replacing the old emojis) so the onyx hub screens read premium and
// consistent. Mirrors lib/plan-visuals.ts. Keyed by hub id (see lib/hubs.ts).
import { Ionicons } from '@expo/vector-icons';

type Glyph = keyof typeof Ionicons.glyphMap;

export const HUB_ICON: Record<string, Glyph> = {
  anxiety: 'leaf-outline',
  grief: 'water-outline',
  hope: 'sunny-outline',
  patience: 'hourglass-outline',
  gratitude: 'heart-outline',
  forgiveness: 'heart-circle-outline',
  doubt: 'help-circle-outline',
  repentance: 'refresh-outline',
  loneliness: 'person-outline',
  guidance: 'compass-outline',
};

export function hubIcon(id: string): Glyph {
  return HUB_ICON[id] ?? 'sparkles-outline';
}
