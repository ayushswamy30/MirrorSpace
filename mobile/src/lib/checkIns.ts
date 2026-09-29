import * as Crypto from 'expo-crypto';

import { getDatabase } from './db/database';
import type { Emotion } from './emotions';

/**
 * Check-ins live only in the encrypted on-device database. Nothing here talks
 * to the network, so checking in works offline and the words never leave the
 * phone; anything derived from them is sent later, and only with consent.
 *
 * A check-in is saved the moment a word is tapped — that one tap is a complete
 * check-in. Tags and a note are optional additions to the same row.
 */

export type CheckIn = {
  id: string;
  createdAt: string;
  localDate: string;
  emotion: string;
  energy: number;
  pleasantness: number;
  tags: string[];
  note: string | null;
};

type Row = {
  id: string;
  created_at: string;
  local_date: string;
  emotion: string;
  energy: number;
  pleasantness: number;
  tags: string;
  note: string | null;
};

/** What was around the feeling (report §5): people, work, body, place. */
export const CONTEXT_TAGS = [
  { key: 'family', group: 'people' },
  { key: 'partner', group: 'people' },
  { key: 'friends', group: 'people' },
  { key: 'alone', group: 'people' },
  { key: 'work', group: 'work' },
  { key: 'study', group: 'work' },
  { key: 'money', group: 'work' },
  { key: 'sleep', group: 'body' },
  { key: 'movement', group: 'body' },
  { key: 'food', group: 'body' },
  { key: 'health', group: 'body' },
  { key: 'home', group: 'place' },
  { key: 'outside', group: 'place' },
  { key: 'travel', group: 'place' }
] as const;

export type ContextTag = (typeof CONTEXT_TAGS)[number]['key'];

const TOUCH = `updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

// Whoever shows something derived from check-ins (the weather, Today) hears
// when a new one lands or a word changes.
const listeners = new Set<() => void>();

export function onCheckInsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed(): void {
  for (const listener of listeners) listener();
}

/** YYYY-MM-DD in the device's current timezone. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromRow(row: Row): CheckIn {
  return {
    id: row.id,
    createdAt: row.created_at,
    localDate: row.local_date,
    emotion: row.emotion,
    energy: row.energy,
    pleasantness: row.pleasantness,
    tags: JSON.parse(row.tags) as string[],
    note: row.note
  };
}

export async function recordCheckIn(emotion: Emotion, now: Date = new Date()): Promise<CheckIn> {
  const db = await getDatabase();
  const checkIn: CheckIn = {
    id: Crypto.randomUUID(),
    createdAt: now.toISOString(),
    localDate: localDate(now),
    emotion: emotion.word,
    energy: emotion.energy,
    pleasantness: emotion.pleasantness,
    tags: [],
    note: null
  };

  await db.runAsync(
    `INSERT INTO check_ins (id, created_at, local_date, emotion, energy, pleasantness)
     VALUES (?, ?, ?, ?, ?, ?)`,
    checkIn.id,
    checkIn.createdAt,
    checkIn.localDate,
    checkIn.emotion,
    checkIn.energy,
    checkIn.pleasantness
  );
  changed();
  return checkIn;
}

/** "Not quite that" — swap the word without making a second check-in. */
export async function changeEmotion(id: string, emotion: Emotion): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE check_ins SET emotion = ?, energy = ?, pleasantness = ?, ${TOUCH} WHERE id = ?`,
    emotion.word,
    emotion.energy,
    emotion.pleasantness,
    id
  );
  changed();
}

export async function setTags(id: string, tags: readonly string[]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE check_ins SET tags = ?, ${TOUCH} WHERE id = ?`, JSON.stringify(tags), id);
  changed();
}

/** A blank note is stored as no note. */
export async function setNote(id: string, note: string): Promise<void> {
  const db = await getDatabase();
  const trimmed = note.trim();
  await db.runAsync(`UPDATE check_ins SET note = ?, ${TOUCH} WHERE id = ?`, trimmed || null, id);
}

export async function latestCheckIn(): Promise<CheckIn | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Row>('SELECT * FROM check_ins ORDER BY created_at DESC LIMIT 1');
  return row ? fromRow(row) : null;
}

/** Every check-in, oldest first — for export and for patterns. */
export async function allCheckIns(): Promise<CheckIn[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM check_ins ORDER BY created_at ASC');
  return rows.map(fromRow);
}

/** The tag lists of the most recent check-ins, newest first. */
export async function recentTags(limit = 30): Promise<string[][]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ tags: string }>(
    'SELECT tags FROM check_ins ORDER BY created_at DESC LIMIT ?',
    limit
  );
  return rows.map(row => JSON.parse(row.tags) as string[]);
}

/**
 * Tags in the order to offer them: the ones this person actually uses first,
 * most-used leading, then the rest in their usual order. Suggestion is only
 * ever reordering — every tag is always there.
 */
export function suggestTags(recent: readonly (readonly string[])[]): ContextTag[] {
  const counts = new Map<string, number>();
  for (const tags of recent) for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);

  // Array.prototype.sort is stable, so ties keep the default order.
  return CONTEXT_TAGS.map(t => t.key).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
}
