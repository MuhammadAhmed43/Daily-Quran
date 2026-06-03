// Small, consistent haptic helpers. Fire-and-forget; never throw (e.g. if the device has
// System Haptics off, or the module is unavailable).
import * as Haptics from 'expo-haptics';

export const haptic = {
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  // Soft, gentle tap — used as the ongoing "typing" pulse while a reply streams in.
  tick: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  },
};
