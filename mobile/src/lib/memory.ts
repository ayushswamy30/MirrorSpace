import * as Crypto from 'expo-crypto';

import { allCheckIns } from './checkIns';
import { getDatabase } from './db/database';
import { kv } from './db/kv';
import { currentMindChart, type MindChart } from './mindChart';
import { facts, sleepFacts } from './patterns';
import { allSleep } from './sleep';

/**
 * "What the Mirror knows" (report §5: "a page listing every remembered fact
 * and pattern; user can correct or delete each one"). The Mirror remembers
 * nothing on the server. What it may know is this page: patterns the phone
 * found (each can be hidden) and notes the person wrote for it (each can be
 * corrected or forgotten). Off until the person switches it on; then the
 * page goes with each message and the Mirror must cite what it draws on.
 */

export type Pattern = { key: string; text: string; receipt: string };
export type Note = { id: string; body: string; createdAt: string; updatedAt: string };
/** What goes with a message: p-items are patterns, n-items notes. */
export type MemoryItem = { id: string; text: string; receipt?: string };

export const MAX_NOTES = 20;
export const MAX_NOTE_CHARS = 300;

const ENABLED = 'mirror.memory.on';
const HIDDEN = 'mirror.memory.hidden';

// ---------------------------------------------------------------------------
// The switch, and hidden patterns

export async function memoryEnabled(): Promise<boolean> {
  return (await kv.get(ENABLED)) === '1';
}

export async function setMemoryEnabled(on: boolean): Promise<void> {
  await kv.set(ENABLED, on ? '1' : '0');
}

export async function hiddenPatterns(): Promise<string[]> {
  const raw = await kv.get(HIDDEN);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function setPatternHidden(key: string, hidden: boolean): Promise<string[]> {
  const current = new Set(await hiddenPatterns());
  if (hidden) current.add(key);
  else current.delete(key);
  const next = [...current].sort();
  await kv.set(HIDDEN, JSON.stringify(next));
  return next;
}

// ---------------------------------------------------------------------------
// Notes

type NoteRow = { id: string; created_at: string; updated_at: string; body: string };

function clean(body: string): string {
  return body.trim().slice(0, MAX_NOTE_CHARS);
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NoteRow>('SELECT * FROM mirror_notes ORDER BY created_at ASC');
  return rows.map(r => ({ id: r.id, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function addNote(body: string, now: Date = new Date()): Promise<Note> {
  const db = await getDatabase();
  const note: Note = { id: Crypto.randomUUID(), body: clean(body), createdAt: now.toISOString(), updatedAt: now.toISOString() };
  await db.runAsync('INSERT INTO mirror_notes (id, created_at, updated_at, body) VALUES (?, ?, ?, ?)', note.id, note.createdAt, note.updatedAt, note.body);
  return note;
}

export async function updateNote(id: string, body: string, now: Date = new Date()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE mirror_notes SET body = ?, updated_at = ? WHERE id = ?', clean(body), now.toISOString(), id);
}

export async function forgetNote(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM mirror_notes WHERE id = ?', id);
}

// ---------------------------------------------------------------------------
// Patterns

/** Every pattern the phone can see right now: this week's facts, and the Mind Chart's placements. */
export function patternsFrom(found: readonly Pattern[], chart: MindChart | null): Pattern[] {
  const out = [...found];
  if (chart) {
    const placed = [
      ['rhythm', chart.rhythm],
      ['hours', chart.hours],
      ['stress', chart.stress],
      ['recovery', chart.recovery],
      ['social', chart.social]
    ] as const;
    for (const [key, p] of placed) if (p.value) out.push({ key: `mind-${key}`, text: p.line, receipt: p.receipt });
    for (const r of chart.restorers) {
      out.push({ key: `restores-${r.tag}`, text: `Check-ins tagged “${r.tag}” have tended to run lighter.`, receipt: `+${r.gap.toFixed(1)} · ${r.count} check-ins` });
    }
    for (const d of chart.drains) {
      out.push({ key: `drains-${d.tag}`, text: `Check-ins tagged “${d.tag}” have tended to run heavier.`, receipt: `−${Math.abs(d.gap).toFixed(1)} · ${d.count} check-ins` });
    }
  }
  return out;
}

export async function currentPatterns(now: Date = new Date()): Promise<Pattern[]> {
  const [checkIns, sleep] = await Promise.all([allCheckIns(), allSleep()]);
  const found = [...facts(checkIns, now), ...sleepFacts(sleep, checkIns, now)].map(f => ({ key: f.key, text: f.text, receipt: f.receipt }));
  const chart = await currentMindChart(now).catch(() => null);
  return patternsFrom(found, chart);
}

/**
 * What goes with a message, or null when the switch is off. Patterns only
 * with the readings consent — they are the reading's numbers.
 */
export async function memoryForMirror(personal: boolean): Promise<MemoryItem[] | null> {
  if (!(await memoryEnabled())) return null;
  const [patterns, hidden, notes] = await Promise.all([personal ? currentPatterns() : Promise.resolve([]), hiddenPatterns(), listNotes()]);
  const shown = patterns.filter(p => !hidden.includes(p.key));
  const items: MemoryItem[] = [
    ...shown.map((p, i) => ({ id: `p${i + 1}`, text: p.text, receipt: p.receipt })),
    ...notes.slice(0, MAX_NOTES).map((n, i) => ({ id: `n${i + 1}`, text: n.body }))
  ];
  return items.length ? items : null;
}

// ---------------------------------------------------------------------------
// Citations

const TAG = /\s?\[([pn]\d{1,2})\]/g;

/** The answer without its tags, and the items it cited, in order of first citation. */
export function citations(reply: string, items: readonly MemoryItem[] | null): { text: string; sources: MemoryItem[] } {
  const ids: string[] = [];
  for (const match of reply.matchAll(TAG)) if (!ids.includes(match[1])) ids.push(match[1]);
  const sources = ids.map(id => items?.find(i => i.id === id)).filter((i): i is MemoryItem => Boolean(i));
  return { text: reply.replace(TAG, '').replace(/\s+([.,;:!?])/g, '$1').trim(), sources };
}
