import * as Crypto from 'expo-crypto';
import type * as NotificationsModule from 'expo-notifications';

import { allCheckIns } from './checkIns';
import { getDatabase } from './db/database';
import { isLowDay } from './glance';
import { remindersSupported } from './reminders';

/**
 * Letters to future self (report: "write now, delivered in 3, 6 or 12
 * months; paused automatically during low stretches"). A letter lives only
 * in the phone's encrypted database. Until its day it is sealed — only its
 * dates show. On its day, if the days have been heavy, it waits another
 * week rather than arrive in the middle of it.
 */

export type Letter = {
  id: string;
  createdAt: string;
  body: string;
  deliverAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
};

type Row = { id: string; created_at: string; body: string; deliver_at: string; delivered_at: string | null; opened_at: string | null };

export type Wait = 3 | 6 | 12;

/** A heavy stretch pushes a due letter back this far, and checks again. */
export const PAUSE_DAYS = 7;

function fromRow(r: Row): Letter {
  return { id: r.id, createdAt: r.created_at, body: r.body, deliverAt: r.deliver_at, deliveredAt: r.delivered_at, openedAt: r.opened_at };
}

function notifications(): typeof NotificationsModule | null {
  if (!remindersSupported) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof NotificationsModule;
}

export function deliveryDate(months: Wait, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + months, now.getDate(), 9, 0);
}

export async function writeLetter(body: string, months: Wait, now: Date = new Date()): Promise<Letter> {
  const letter: Letter = {
    id: Crypto.randomUUID(),
    createdAt: now.toISOString(),
    body: body.trim(),
    deliverAt: deliveryDate(months, now).toISOString(),
    deliveredAt: null,
    openedAt: null
  };
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO letters (id, created_at, body, deliver_at) VALUES (?, ?, ?, ?)',
    letter.id,
    letter.createdAt,
    letter.body,
    letter.deliverAt
  );
  // A quiet nudge on the day; nothing of the letter on the lock screen. If
  // the day turns out heavy, the app holds the letter back when it opens.
  const N = notifications();
  if (N && (await N.getPermissionsAsync()).granted) {
    await N.scheduleNotificationAsync({
      content: { title: 'MirrorSpace', body: 'A letter you wrote is ready, when you are.', data: { url: '/check-in?mode=letter' } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(letter.deliverAt), channelId: 'reminders' }
    });
  }
  return letter;
}

export async function listLetters(): Promise<Letter[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM letters ORDER BY deliver_at ASC');
  return rows.map(fromRow);
}

/**
 * Delivers letters whose day has come — unless the days have been heavy, in
 * which case each waits another week. Returns what was delivered now.
 */
export async function deliverDue(now: Date = new Date()): Promise<Letter[]> {
  const db = await getDatabase();
  const due = (await db.getAllAsync<Row>('SELECT * FROM letters WHERE delivered_at IS NULL AND deliver_at <= ?', now.toISOString())).map(fromRow);
  if (due.length === 0) return [];

  if (isLowDay(await allCheckIns(), now)) {
    const later = new Date(now.getTime() + PAUSE_DAYS * 24 * 3600 * 1000).toISOString();
    for (const l of due) await db.runAsync('UPDATE letters SET deliver_at = ? WHERE id = ?', later, l.id);
    return [];
  }
  for (const l of due) await db.runAsync('UPDATE letters SET delivered_at = ? WHERE id = ?', now.toISOString(), l.id);
  return due.map(l => ({ ...l, deliveredAt: now.toISOString() }));
}

export async function markOpened(id: string, now: Date = new Date()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE letters SET opened_at = COALESCE(opened_at, ?) WHERE id = ?', now.toISOString(), id);
}

export async function deleteLetter(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM letters WHERE id = ?', id);
}
