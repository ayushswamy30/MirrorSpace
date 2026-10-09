import type * as NotificationsModule from 'expo-notifications';

import { api, ApiError } from './api';
import { getDatabase } from './db/database';
import { isPreview } from './preview';
import { remindersSupported } from './reminders';
import { atLeast, screenText } from './safety/screen';

/**
 * Delayed reflections (report §7: "vent now, a quiet observation arrives
 * hours later"). With the AI-reflections consent on, a kept page goes to the
 * server once, comes back as two or three sentences, and is kept here —
 * hidden until a few hours have passed, so it reads as something that sat
 * with the page rather than an instant reply.
 *
 * A page that screens elevated or acute is never sent: the crisis protocol
 * answers it, not an AI. Nothing is sent without the consent, and the server
 * keeps nothing.
 */

export const DELAY_MS = 3 * 60 * 60 * 1000;

export type Reflection = { text: string; visibleAt: string } | null;

function notifications(): typeof NotificationsModule | null {
  if (!remindersSupported) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof NotificationsModule;
}

/** Whether a page may be sent at all. */
export function mayReflect(body: string): boolean {
  return !atLeast(screenText(body), 'elevated');
}

/** Asks for the reflection on one kept page; leaves it pending if that fails. */
export async function requestReflection(id: string, body: string, now: Date = new Date()): Promise<void> {
  const db = await getDatabase();
  if (!mayReflect(body)) {
    await db.runAsync(`UPDATE vents SET reflection_state = 'never' WHERE id = ?`, id);
    return;
  }
  await db.runAsync(`UPDATE vents SET reflection_state = 'pending' WHERE id = ?`, id);
  if (isPreview) return;

  try {
    const { reflection } = await api.post<{ reflection: string }>('/mirror/reflect', { text: body });
    const visibleAt = new Date(now.getTime() + DELAY_MS);
    await db.runAsync(
      `UPDATE vents SET reflection = ?, reflection_at = ?, reflection_state = 'ready' WHERE id = ?`,
      reflection,
      visibleAt.toISOString(),
      id
    );
    await announce(visibleAt);
  } catch (error) {
    // No consent, or reflections switched off: stop asking for this page.
    if (error instanceof ApiError && (error.status === 403 || error.status === 400)) {
      await db.runAsync(`UPDATE vents SET reflection_state = 'never' WHERE id = ?`, id);
    }
    // Otherwise (offline, a sleeping server) it stays pending for the next open.
  }
}

/** Retries pages still waiting for their reflection — called when the app opens. */
export async function retryPending(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; body: string }>(
    `SELECT id, body FROM vents WHERE reflection_state = 'pending' ORDER BY created_at DESC LIMIT 3`
  );
  for (const row of rows) await requestReflection(row.id, row.body);
}

/** A quiet notification when the reflection becomes visible — nothing of it on the lock screen. */
async function announce(at: Date): Promise<void> {
  const N = notifications();
  if (!N || !(await N.getPermissionsAsync()).granted) return;
  await N.scheduleNotificationAsync({
    content: { title: 'Lowkei', body: 'A reflection on something you wrote is waiting.', data: { url: '/check-in?mode=vent' } },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' }
  });
}

/** What the page view shows: the reflection once it's time, otherwise when it will be. */
export function visibleReflection(row: { reflection: string | null; reflectionAt: string | null }, now: Date = new Date()): {
  text: string | null;
  waitingUntil: Date | null;
} {
  if (!row.reflection || !row.reflectionAt) return { text: null, waitingUntil: null };
  const at = new Date(row.reflectionAt);
  return at.getTime() <= now.getTime() ? { text: row.reflection, waitingUntil: null } : { text: null, waitingUntil: at };
}
