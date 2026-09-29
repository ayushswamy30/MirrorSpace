import { localDate } from './checkIns';
import { getDatabase } from './db/database';

/**
 * Sleep, logged by hand — the consent screen's promise ("you can log sleep by
 * hand instead") until Health Connect / HealthKit arrive. One row per night,
 * named by the morning it ended on. Stays on the phone.
 */

export type SleepLog = {
  /** The local date of the morning: "last night" is today's row. */
  wakeDate: string;
  bedAt: string;
  wakeAt: string;
  minutes: number;
};

type Row = { wake_date: string; bed_at: string; wake_at: string; minutes: number };

const STEP_MIN = 15;

/** Minutes past midnight, in whole steps. */
export type ClockTime = number;

export const DEFAULT_BED: ClockTime = 23 * 60;
export const DEFAULT_WAKE: ClockTime = 7 * 60;

export function step(time: ClockTime, by: 1 | -1): ClockTime {
  return (time + by * STEP_MIN + 1440) % 1440;
}

export function formatClock(time: ClockTime): string {
  const h = Math.floor(time / 60);
  const m = time % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * A night from two clock times, waking on `wakeDay`. A bedtime later in the
 * day than the wake time was the evening before; an earlier one (00:40) was
 * after midnight, on the wake day itself.
 */
export function night(bed: ClockTime, wake: ClockTime, wakeDay: Date): SleepLog {
  const wakeAt = new Date(wakeDay.getFullYear(), wakeDay.getMonth(), wakeDay.getDate(), 0, wake);
  const bedDayOffset = bed >= wake ? -1 : 0;
  const bedAt = new Date(wakeDay.getFullYear(), wakeDay.getMonth(), wakeDay.getDate() + bedDayOffset, 0, bed);
  const minutes = Math.round((wakeAt.getTime() - bedAt.getTime()) / 60_000);
  return { wakeDate: localDate(wakeAt), bedAt: bedAt.toISOString(), wakeAt: wakeAt.toISOString(), minutes };
}

export function clockOf(iso: string): ClockTime {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

const listeners = new Set<() => void>();

/** Today hears when a night is logged or changed. */
export function onSleepChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function saveSleep(log: SleepLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sleep_logs (wake_date, bed_at, wake_at, minutes) VALUES (?, ?, ?, ?)
     ON CONFLICT (wake_date) DO UPDATE SET bed_at = excluded.bed_at, wake_at = excluded.wake_at,
       minutes = excluded.minutes, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    log.wakeDate,
    log.bedAt,
    log.wakeAt,
    log.minutes
  );
  for (const listener of listeners) listener();
}

export async function allSleep(): Promise<SleepLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM sleep_logs ORDER BY wake_date ASC');
  return rows.map(r => ({ wakeDate: r.wake_date, bedAt: r.bed_at, wakeAt: r.wake_at, minutes: r.minutes }));
}
