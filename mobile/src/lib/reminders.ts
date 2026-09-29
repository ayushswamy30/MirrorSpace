import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { allCheckIns, localDate, type CheckIn } from './checkIns';
import { kv } from './db/kv';

/**
 * The daily reminder (report §5: "timed to the user's rhythm, never more than
 * one a day by default"). Off until asked for.
 *
 * Only ever one reminder is pending: the next usual check-in time that isn't
 * on a day already checked in. It is rescheduled whenever the app opens or a
 * check-in lands, so a week away brings one gentle nudge, not seven — and
 * never a streak or a guilt line.
 */

const ENABLED_KEY = 'reminder.enabled';
const CHANNEL = 'reminders';
const STEP = 15;

export const DEFAULT_TIME = 21 * 60;

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
  return (await kv.get(ENABLED_KEY)) === '1';
}

/** Asks the system once; false if the person said no. */
export async function enableReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;
  await kv.set(ENABLED_KEY, '1');
  await syncReminder();
  return true;
}

export async function disableReminders(): Promise<void> {
  await kv.set(ENABLED_KEY, '0');
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Replaces whatever is pending with the one right reminder, or none. */
export async function syncReminder(now: Date = new Date()): Promise<Date | null> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await remindersEnabled())) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily reminder',
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const checkIns = await allCheckIns();
  const at = nextReminder(usualTime(checkIns, now), checkIns.some(c => c.localDate === localDate(now)), now);
  await Notifications.scheduleNotificationAsync({
    // Nothing personal on a lock screen: no feeling, no count, no streak.
    content: { title: 'MirrorSpace', body: 'A word for today, if you have one.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL }
  });
  return at;
}
