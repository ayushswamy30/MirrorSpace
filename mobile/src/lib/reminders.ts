import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { allCheckIns, localDate, type CheckIn } from './checkIns';
import { dailyNoteWanted, noteForNow, saveDailyNote, upcomingNotes, type DailyNote } from './dailyNote';
import { kv } from './db/kv';
import { inExpoGo } from './runtime';
import { askWebPush, sendWebTest, syncWebPush, webPushAllowed, webPushSupported } from './webPush';

/**
 * The daily reminder (report §5: "timed to the user's rhythm, never more than
 * one a day by default"), off until asked for, and the 11:11 daily note
 * (dailyNote.ts), on once notifications are allowed.
 *
 * A week of each is handed over at a time, so they keep arriving on days the
 * app isn't opened: the reminder at the usual check-in time — skipping today
 * once there's a check-in — and the note at 11:11. Both are rewritten
 * whenever the app opens or a check-in lands. Never a streak or a guilt line.
 *
 * expo-notifications throws as soon as it loads in Expo Go on Android (it was
 * removed there in SDK 53), so it is loaded only in Lowkei's own build. The
 * web app on a Home Screen can't schedule anything itself: the server sends
 * its reminder at the time worked out here (see webPush.ts).
 */

const ENABLED_KEY = 'reminder.enabled';
const CHANNEL = 'reminders';
const STEP = 15;
const DAYS_AHEAD = 7;
const REMINDER_TEXT = 'A word for today, if you have one.';

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

/** The reminder for each of the next `days` days, starting with the next one. */
export function nextReminders(time: number, checkedInToday: boolean, now: Date = new Date(), days = DAYS_AHEAD): Date[] {
  const first = nextReminder(time, checkedInToday, now);
  return Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, 0, time));
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

async function notificationsAllowed(): Promise<boolean> {
  if (webPushSupported) return webPushAllowed();
  const N = notifications();
  return N ? (await N.getPermissionsAsync()).granted : false;
}

/** The 11:11 note: wanted, and notifications allowed. */
export async function dailyNoteEnabled(): Promise<boolean> {
  return remindersSupported && (await dailyNoteWanted()) && (await notificationsAllowed());
}

/** Asks for notifications if need be (first thing, for iPhone), then schedules the week's notes. */
export async function enableDailyNote(): Promise<boolean> {
  if (webPushSupported) {
    if (!(await askWebPush())) return false;
  } else {
    const N = notifications();
    if (!N) return false;
    const granted = (await N.getPermissionsAsync()).granted || (await N.requestPermissionsAsync()).granted;
    if (!granted) return false;
  }
  await saveDailyNote(true);
  await syncReminder();
  return true;
}

export async function disableDailyNote(): Promise<void> {
  await saveDailyNote(false);
  await syncReminder();
}

/**
 * The reminders and the daily notes. Letters' and reflections' notices name
 * where a tap goes and keep their day; reminders name nowhere, and notes say
 * they are notes.
 */
async function cancelReminder(N: typeof NotificationsModule): Promise<void> {
  const pending = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter(p => !p.content.data?.url || p.content.data?.kind === 'daily')
      .map(p => N.cancelScheduledNotificationAsync(p.identifier))
  );
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
 * Today's note, a few seconds from now, so the person can see what one looks
 * like and that it arrives. It doesn't touch the scheduled ones. The system
 * already shows the app's name, so the title is the note itself.
 */
export async function sendTestReminder(seconds = 5): Promise<boolean> {
  if (!(await remindersEnabled()) && !(await dailyNoteEnabled())) return false;
  const note = await noteForNow();
  if (webPushSupported) return sendWebTest(note);
  const N = notifications();
  if (!N) return false;
  await ensureChannel(N);
  await N.scheduleNotificationAsync({
    content: { title: note.title, body: note.body, data: { test: true } },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL }
  });
  return true;
}

async function remindersFor(now: Date): Promise<Date[]> {
  const checkIns = await allCheckIns();
  return nextReminders(usualTime(checkIns, now), checkIns.some(c => c.localDate === localDate(now)), now);
}

async function notesFor(now: Date): Promise<DailyNote[]> {
  return (await dailyNoteEnabled()) ? upcomingNotes(now).catch(() => []) : [];
}

/**
 * Replaces whatever reminders and notes are pending with the week's right
 * ones, or none; returns when the next reminder is. On the web app this also
 * hands the server the sealed letters' days, and keeps Circle alerts' address
 * current, whether reminders are on or not.
 */
export async function syncReminder(now: Date = new Date()): Promise<Date | null> {
  if (webPushSupported) {
    const reminders = (await remindersEnabled()) ? await remindersFor(now) : [];
    await syncWebPush({ reminders, notes: await notesFor(now) }, now);
    return reminders[0] ?? null;
  }
  const N = notifications();
  if (!N) return null;
  await cancelReminder(N);
  const reminders = (await remindersEnabled()) ? await remindersFor(now) : [];
  const notes = await notesFor(now);
  if (reminders.length === 0 && notes.length === 0) return null;

  await ensureChannel(N);
  for (const at of reminders) {
    await N.scheduleNotificationAsync({
      // Nothing personal: no feeling, no count, no streak. The system shows the app's name.
      content: { title: REMINDER_TEXT },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL }
    });
  }
  for (const note of notes) {
    await N.scheduleNotificationAsync({
      content: { title: note.title, body: note.body, data: { kind: 'daily', url: '/' } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: note.at, channelId: CHANNEL }
    });
  }
  return reminders[0] ?? null;
}
