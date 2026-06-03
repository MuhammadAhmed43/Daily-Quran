// One place to configure how local notifications present, ask permission, and - crucially - cancel
// them BY KIND. Two features schedule notifications: the adhan (lib/prayer.ts) and the daily-verse
// reminder (lib/daily-verse.ts). Each must cancel only its OWN kind via cancelByType(); calling
// Notifications.cancelAllScheduledNotificationsAsync() would wipe the other feature's reminders.
import * as Notifications from 'expo-notifications';

// Show the alert even when the app is foregrounded (set once, on import).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotifType = 'adhan' | 'daily_verse';

export async function ensureNotifPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return req.granted;
}

// Cancel only the scheduled notifications of a given kind (tagged via content.data.type). Never
// touches the other kind, so adhan + daily-verse reminders coexist safely.
export async function cancelByType(type: NotifType): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as { type?: string } | null | undefined)?.type === type)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
