import * as Crypto from 'expo-crypto';

import { localDate } from './checkIns';
import { getDatabase } from './db/database';
import { kv } from './db/kv';
import type { PageKind } from './prompts';

/**
 * Vent (report §5, §7): a blank page, then "keep" or "let go". Kept pages live
 * only in the encrypted on-device database; a page that is let go is never
 * written anywhere. The draft is kept too, encrypted, so a phone call in the
 * middle of writing loses nothing.
 */

export type Vent = {
  id: string;
  createdAt: string;
  localDate: string;
  body: string;
  /** A free page, or one of the guided shapes. */
  kind?: PageKind;
  /** The delayed reflection, once it has come back (shown from `reflectionAt`). */
  reflection?: string | null;
  reflectionAt?: string | null;
};

type Row = {
  id: string;
  created_at: string;
  local_date: string;
  body: string;
  kind?: PageKind;
  reflection?: string | null;
  reflection_at?: string | null;
};

const DRAFT_KEY = 'vent.draft';

function fromRow(row: Row): Vent {
  return {
    id: row.id,
    createdAt: row.created_at,
    localDate: row.local_date,
    body: row.body,
    kind: row.kind ?? 'page',
    reflection: row.reflection ?? null,
    reflectionAt: row.reflection_at ?? null
  };
}

export async function keepVent(body: string, now: Date = new Date(), kind: PageKind = 'page'): Promise<Vent> {
  const vent: Vent = {
    id: Crypto.randomUUID(),
    createdAt: now.toISOString(),
    localDate: localDate(now),
    body: body.trim(),
    kind
  };
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO vents (id, created_at, local_date, body, kind) VALUES (?, ?, ?, ?, ?)',
    vent.id,
    vent.createdAt,
    vent.localDate,
    vent.body,
    kind
  );
  await clearDraft();
  return vent;
}

export async function listVents(limit = 50): Promise<Vent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM vents ORDER BY created_at DESC LIMIT ?', limit);
  return rows.map(fromRow);
}

/** The day of every kept page, oldest first — counts only, never the words. */
export async function pageDates(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ local_date: string }>('SELECT local_date FROM vents ORDER BY created_at ASC');
  return rows.map(r => r.local_date);
}

export async function deleteVent(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM vents WHERE id = ?', id);
}

export const draft = {
  get: () => kv.get(DRAFT_KEY),
  set: (text: string) => (text.trim() ? kv.set(DRAFT_KEY, text) : kv.remove(DRAFT_KEY)),
  clear: () => clearDraft()
};

function clearDraft(): Promise<void> {
  return kv.remove(DRAFT_KEY);
}

/** The first line of a page, for a list row. */
export function firstLine(body: string, max = 60): string {
  const line = body.trim().split(/\n/)[0] ?? '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
