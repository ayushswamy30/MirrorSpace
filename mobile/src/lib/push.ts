import Constants from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { remindersSupported, syncReminder } from './reminders';
import { askWebPush, onWebAlertTapped, saveWebAlerts, webPushAllowed, type AlertPath } from './webPush';

/**
 * Circle alerts: a friend's "running low", "thinking of you", a request.
 * The phone hands the API its Expo push token so those can reach it; what
 * they say is decided on the server, and never names anyone on a lock screen.
 *
 * Like reminders, this needs Lowkei's own build — not Expo Go, not the
 * browser preview. On Android it also needs Firebase set up for the project
 * (google-services.json and an FCM key in EAS); without that, asking for a
 * token fails and alerts simply stay off. The web app on a Home Screen gets
 * them through the browser's push service instead (webPush.ts).
 */

const CHANNEL = 'circle';

export const pushSupported = remindersSupported;

function notifications(): typeof NotificationsModule | null {
  if (!pushSupported || Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof NotificationsModule;
}

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
}

/** Asks once, when it matters — starting a circle. False if declined. */
export async function askForAlerts(): Promise<boolean> {
  if (Platform.OS === 'web') {
    const granted = await askWebPush();
    if (granted) await syncReminder();
    return granted;
  }
  const N = notifications();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  const granted = current.granted || (await N.requestPermissionsAsync()).granted;
  if (granted) await registerForAlerts();
  return granted;
}

/**
 * The web app's own switch for letters, reflections and Circle alerts (You →
 * Notifications). Switching on asks the browser first, straight from the tap;
 * false if it said no.
 */
export async function setWebAlerts(on: boolean): Promise<boolean> {
  if (on && !(await askWebPush())) return false;
  await saveWebAlerts(on);
  await syncReminder();
  return true;
}

/**
 * Sends this phone's token to the API, if notifications are already allowed.
 * Never prompts. Safe to call on every launch: the server keeps one row per
 * token.
 */
export async function registerForAlerts(): Promise<boolean> {
  // On the web app, ReminderSync keeps the address current.
  if (Platform.OS === 'web') return webPushAllowed();
  const N = notifications();
  const id = projectId();
  if (!N || !id) return false;
  if (!(await N.getPermissionsAsync()).granted) return false;

  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, { name: 'Your circle', importance: N.AndroidImportance.DEFAULT });
  }
  const { data: token } = await N.getExpoPushTokenAsync({ projectId: id });
  await api.put('/user/push-token', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  return true;
}

/** Where a tapped alert should open, if it names somewhere we know. */
export function alertTarget(data: unknown): '/circle' | null {
  return (data as { url?: unknown } | null)?.url === '/circle' ? '/circle' : null;
}

/** Calls back with the screen to open whenever an alert is tapped. */
export function onAlertTapped(open: (path: AlertPath) => void): () => void {
  if (Platform.OS === 'web') return onWebAlertTapped(open);
  const N = notifications();
  if (!N) return () => undefined;
  const sub = N.addNotificationResponseReceivedListener(response => {
    const target = alertTarget(response.notification.request.content.data);
    if (target) open(target);
  });
  return () => sub.remove();
}
