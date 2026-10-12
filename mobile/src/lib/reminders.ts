import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { allCheckIns, localDate, type CheckIn } from './checkIns';
import { kv } from './db/kv';
import { inExpoGo } from './runtime';
import { askWebPush, sendWebTest, syncWebPush, webPushSupported } from './webPush';

/**
 * The daily reminder (report §5: "timed to the user's rhythm, never more than
 * one a day by default"). Off until asked for.
 *
 * Only ever one reminder is pending: the next usual check-in time that isn't
 * on a day already checked in. It is rescheduled whenever the app opens or a
 * check-in lands, so a week away brings one gentle nudge, not seven — and
 * never a streak or a guilt line.
 *
 * expo-notifications throws as soon as it loads in Expo Go on Android (it was
 * removed there in SDK 53), so it is loaded only in Lowkei's own build. The
 * web app on a Home Screen can't schedule anything itself: the server sends
 * its reminder at the time worked out here (see webPush.ts).
 */

const ENABLED_KEY = 'reminder.enabled';
const CHANNEL = 'reminders';
const STEP = 15;

export const DEFAULT_TIME = 21 * 60;

const native = !inExpoGo && Platform.OS !== 'web';

/**
 * Lowkei's own build, or the web app opened from a Home Screen. False in Expo
 * Go, the browser preview, and the web app in a browser tab.
 */
export const remindersSupported = native || webPushSupported;

/** Where a tapped letter notice goes. */
export const LETTER_URL = '/check-in?mode=letter';

function notifications(): typeof NotificationsModule | null {
  if (!native) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof NotificationsModule;
}

/** The median check-in time over the last two weeks, to the quarter hour. */
export function usualTime(checkIns: readonly CheckIn[], now: Date = new Date()): number {
  const from = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const minutes = checkIns
    .filter(c => new Date(c.createdAt).getTime() >= from)
    .map(c => {
      const d = new Date(c.createdAt);
      return d.getHours() * 60 + d.getMinutes();
    })
    .sort((a, b) => a - b);
  if (minutes.length < 3) return DEFAULT_TIME;
  const mid = minutes[Math.floor(minutes.length / 2)];
  return (Math.round(mid / STEP) * STEP) % 1440;
}

/**
 * When the one pending reminder should fire: at `time` today if that is still
 * ahead and there's no check-in today, otherwise tomorrow at `time`.
 */
export function nextReminder(time: number, checkedInToday: boolean, now: Date = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, time);
  if (!checkedInToday && today.getTime() > now.getTime()) return today;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, time);
}

export async function remindersEnabled(): Promise<boolean> {
  return remindersSupported && (await kv.get(ENABLED_KEY)) === '1';
}

/** Asks the system once; false if the person said no, or in Expo Go. */
export async function enableReminders(): Promise<boolean> {
  if (webPushSupported) {
    // Straight from the tap, before anything else is awaited.
    if (!(await askWebPush())) return false;
    await kv.set(ENABLED_KEY, '1');
    await syncReminder();
    return true;
  }
  const N = notifications();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  const granted = current.granted || (await N.requestPermissionsAsync()).granted;
  if (!granted) return false;
  await kv.set(ENABLED_KEY, '1');
  await syncReminder();
  return true;
}

export async function disableReminders(): Promise<void> {
  await kv.set(ENABLED_KEY, '0');
  if (webPushSupported) {
    await syncReminder();
    return;
  }
  const N = notifications();
  if (N) await cancelReminder(N);
}

/**
 * Only the reminder. Letters' and reflections' notices name where a tap goes
 * and keep their day; the reminder (and the test) name nowhere.
 */
async function cancelReminder(N: typeof NotificationsModule): Promise<void> {
  const pending = await N.getAllScheduledNotificationsAsync();
  await Promise.all(pending.filter(p => !p.content.data?.url).map(p => N.cancelScheduledNotificationAsync(p.identifier)));
}

/**
 * No banner while the app is already open — except the test reminder, which
 * is asked for from inside the app and has to be seen to be any use. Called
 * once, at start-up.
 */
export function quietWhileOpen(): void {
  notifications()?.setNotificationHandler({
    handleNotification: async notification => {
      const show = notification.request.content.data?.test === true;
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
    }
  });
}

async function ensureChannel(N: typeof NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily reminder',
    importance: N.AndroidImportance.DEFAULT
  });
}

/**
 * The same reminder, a few seconds from now, so the person can see what it
 * looks like and that it arrives. It doesn't touch the scheduled one.
 */
export async function sendTestReminder(seconds = 5): Promise<boolean> {
  if (webPushSupported) return (await remindersEnabled()) && sendWebTest();
  const N = notifications();
  if (!N || !(await remindersEnabled())) return false;
  await ensureChannel(N);
  await N.scheduleNotificationAsync({
    content: { title: 'Lowkei', body: 'A word for today, if you have one.', data: { test: true } },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL }
  });
  return true;
}

async function nextFor(now: Date): Promise<Date> {
  const checkIns = await allCheckIns();
  return nextReminder(usualTime(checkIns, now), checkIns.some(c => c.localDate === localDate(now)), now);
}

/**
 * Replaces whatever reminder is pending with the one right reminder, or none.
 * On the web app this also hands the server the sealed letters' days, and
 * keeps Circle alerts' address current, whether reminders are on or not.
 */
export async function syncReminder(now: Date = new Date()): Promise<Date | null> {
  if (webPushSupported) {
    const next = (await remindersEnabled()) ? await nextFor(now) : null;
    await syncWebPush(next, now);
    return next;
  }
  const N = notifications();
  if (!N) return null;
  await cancelReminder(N);
  if (!(await remindersEnabled())) return null;

  await ensureChannel(N);

  const at = await nextFor(now);
  await N.scheduleNotificationAsync({
    // Nothing personal on a lock screen: no feeling, no count, no streak.
    content: { title: 'Lowkei', body: 'A word for today, if you have one.' },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL }
  });
  return at;
}
