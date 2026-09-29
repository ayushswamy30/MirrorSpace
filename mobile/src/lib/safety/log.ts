import { getDatabase } from '../db/database';
import { kv } from '../db/kv';

import type { Tier } from './screen';

/**
 * "Log without reading" (report §8): a safety event is its tier, where it came
 * from and when — never the words, and never a link back to the entry that
 * raised it. That is enough for the annual count of crisis responses and for
 * nothing else.
 */

export type SafetySource = 'check_in' | 'vent' | 'chat';

/** After an acute response the AI stops reflecting for a day (report §8). */
const PAUSE_KEY = 'safety.reflectionsPausedUntil';
const PAUSE_MS = 24 * 60 * 60 * 1000;

export async function recordSafetyEvent(
  tier: Exclude<Tier, 'none'>,
  source: SafetySource,
  now: Date = new Date()
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO safety_events (tier, source, created_at) VALUES (?, ?, ?)',
    tier,
    source,
    now.toISOString()
  );
  if (tier === 'acute') {
    await kv.set(PAUSE_KEY, new Date(now.getTime() + PAUSE_MS).toISOString());
  }
}

export type SafetyEvent = { tier: Exclude<Tier, 'none'>; source: SafetySource; createdAt: string };

/** Every event, oldest first — only for the person's own export. */
export async function listSafetyEvents(): Promise<SafetyEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ tier: SafetyEvent['tier']; source: SafetySource; created_at: string }>(
    'SELECT tier, source, created_at FROM safety_events ORDER BY created_at ASC'
  );
  return rows.map(r => ({ tier: r.tier, source: r.source, createdAt: r.created_at }));
}

/** Mirror chat and reflections check this before replying. */
export async function reflectionsPaused(now: Date = new Date()): Promise<boolean> {
  const until = await kv.get(PAUSE_KEY);
  return until !== null && new Date(until).getTime() > now.getTime();
}
