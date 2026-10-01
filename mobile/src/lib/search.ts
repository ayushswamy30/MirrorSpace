import { getDatabase } from './db/database';

/**
 * Search across what the person has written (report: "on-device full-text
 * search"): kept pages, check-in notes and the words chosen. It runs in the
 * phone's encrypted database and never leaves it.
 */

export type Hit = {
  kind: 'page' | 'note' | 'word';
  id: string;
  /** The day it belongs to, for opening it on Today. */
  localDate: string;
  createdAt: string;
  /** A short window around the match. */
  snippet: string;
};

/** LIKE treats % and _ as wildcards; a search for them should find them. */
function pattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`;
}

/** A window of text around the first match, trimmed at word edges. */
export function snippet(text: string, query: string, radius = 48): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return flat.slice(0, radius * 2);
  let start = Math.max(0, at - radius);
  let end = Math.min(flat.length, at + query.length + radius);
  // Never cut a word in half: move the edges out of any word they land in.
  if (start > 0 && flat[start - 1] !== ' ') start = flat.indexOf(' ', start) + 1 || start;
  if (end < flat.length && flat[end] !== ' ') end = flat.lastIndexOf(' ', end) > at ? flat.lastIndexOf(' ', end) : end;
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

export async function search(query: string, limit = 40): Promise<Hit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const db = await getDatabase();
  const like = pattern(q);

  const [pages, notes, words] = await Promise.all([
    db.getAllAsync<{ id: string; local_date: string; created_at: string; body: string }>(
      `SELECT id, local_date, created_at, body FROM vents WHERE body LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`,
      like,
      limit
    ),
    db.getAllAsync<{ id: string; local_date: string; created_at: string; note: string }>(
      `SELECT id, local_date, created_at, note FROM check_ins WHERE note LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`,
      like,
      limit
    ),
    db.getAllAsync<{ id: string; local_date: string; created_at: string; emotion: string }>(
      `SELECT id, local_date, created_at, emotion FROM check_ins WHERE emotion LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`,
      like,
      limit
    )
  ]);

  return [
    ...pages.map(r => ({ kind: 'page' as const, id: r.id, localDate: r.local_date, createdAt: r.created_at, snippet: snippet(r.body, q) })),
    ...notes.map(r => ({ kind: 'note' as const, id: r.id, localDate: r.local_date, createdAt: r.created_at, snippet: snippet(r.note, q) })),
    ...words.map(r => ({ kind: 'word' as const, id: `${r.id}-w`, localDate: r.local_date, createdAt: r.created_at, snippet: r.emotion }))
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
