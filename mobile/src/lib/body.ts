import type * as HealthConnectModule from 'react-native-health-connect';

import { localDate, type CheckIn } from './checkIns';
import { getDatabase } from './db/database';
import { kv } from './db/kv';
import type { Fact } from './patterns';

/**
 * Body signals from Health Connect (report: "passive signals — steps, HRV,
 * resting HR"): a second, separate permission on top of sleep. One row per
 * day — steps, resting heart rate, heart-rate variability — kept only on the
 * phone and never sent anywhere, not even to the Mirror. They become plain
 * facts on Today, with their receipts, like everything else.
 */

export type BodyDay = { date: string; steps: number | null; restingHr: number | null; hrv: number | null };

export const BODY_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' }
] as const;

const ON_KEY = 'health.body';
const FULL_DAYS = 30;
const RECENT_DAYS = 3;

export async function bodyConnected(): Promise<boolean> {
  return (await kv.get(ON_KEY)) === '1';
}

export async function setBodyConnected(on: boolean): Promise<void> {
  await kv.set(ON_KEY, on ? '1' : '0');
}

type Row = { date: string; steps: number | null; resting_hr: number | null; hrv: number | null };

export async function allBodyDays(): Promise<BodyDay[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM body_days ORDER BY date ASC');
  return rows.map(r => ({ date: r.date, steps: r.steps, restingHr: r.resting_hr, hrv: r.hrv }));
}

export async function saveBodyDays(days: readonly BodyDay[]): Promise<void> {
  const db = await getDatabase();
  for (const d of days) {
    await db.runAsync(
      `INSERT INTO body_days (date, steps, resting_hr, hrv) VALUES (?, ?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET steps = excluded.steps, resting_hr = excluded.resting_hr, hrv = excluded.hrv,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      d.date,
      d.steps,
      d.restingHr,
      d.hrv
    );
  }
}

export async function deleteBodyDays(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM body_days');
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

/** Instantaneous readings → the day's average, by the local date they were taken. */
export function dailyAverages(records: readonly { time: string; value: number }[]): Map<string, number> {
  const byDay = new Map<string, number[]>();
  for (const r of records) {
    const day = localDate(new Date(r.time));
    byDay.set(day, [...(byDay.get(day) ?? []), r.value]);
  }
  return new Map([...byDay].map(([day, values]) => [day, mean(values)!]));
}

/**
 * Reads the days not yet read in full — a month the first time, then the
 * last three days (today's steps keep growing) — into the phone's own table.
 */
export async function syncBody(H: typeof HealthConnectModule, now: Date = new Date()): Promise<number> {
  if (!(await bodyConnected())) return 0;
  const first = (await allBodyDays()).length === 0;
  const span = first ? FULL_DAYS : RECENT_DAYS;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1));
  const range = { operator: 'between' as const, startTime: start.toISOString(), endTime: now.toISOString() };

  const [rest, hrv] = await Promise.all([
    H.readRecords('RestingHeartRate', { timeRangeFilter: range }),
    H.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: range })
  ]);
  const restBy = dailyAverages(rest.records.map(r => ({ time: r.time, value: r.beatsPerMinute })));
  const hrvBy = dailyAverages(hrv.records.map(r => ({ time: r.time, value: r.heartRateVariabilityMillis })));

  const days: BodyDay[] = [];
  for (let i = 0; i < span; i++) {
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const date = localDate(from);
    // Aggregated, so steps counted by both phone and watch aren't doubled.
    const steps = await H.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: (to < now ? to : now).toISOString() }
    }).catch(() => null);
    days.push({
      date,
      steps: steps && steps.COUNT_TOTAL > 0 ? steps.COUNT_TOTAL : null,
      restingHr: restBy.has(date) ? Math.round(restBy.get(date)!) : null,
      hrv: hrvBy.has(date) ? Math.round(hrvBy.get(date)!) : null
    });
  }
  await saveBodyDays(days);
  return days.length;
}

// ---------------------------------------------------------------------------
// Facts

const MIN_DAYS = 3;
const STEP_MOOD_GAP = 1.5;
const HR_RISE = 5;
const HRV_DROP = 0.15;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Plain facts from the body, against the person's own last month:
 * walking-more days against the rest, and this week's resting heart rate
 * and HRV against their usual.
 */
export function bodyFacts(days: readonly BodyDay[], checkIns: readonly CheckIn[], now: Date = new Date()): Fact[] {
  const out: Fact[] = [];
  const monthFrom = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const weekFrom = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const month = days.filter(d => d.date >= monthFrom);

  // Steps against mood: days above the person's median, against those below.
  const stepped = month.filter(d => d.steps !== null);
  if (stepped.length >= MIN_DAYS * 2) {
    const mid = median(stepped.map(d => d.steps!));
    const moodOn = (date: string) => mean(checkIns.filter(c => c.localDate === date).map(c => c.pleasantness));
    const more = stepped.filter(d => d.steps! > mid).map(d => moodOn(d.date)).filter((m): m is number => m !== null);
    const less = stepped.filter(d => d.steps! <= mid).map(d => moodOn(d.date)).filter((m): m is number => m !== null);
    if (more.length >= MIN_DAYS && less.length >= MIN_DAYS) {
      const gap = mean(more)! - mean(less)!;
      if (Math.abs(gap) >= STEP_MOOD_GAP) {
        out.push({
          key: 'steps-mood',
          text: gap > 0 ? 'On days you walked more, check-ins tended to be lighter.' : 'On days you walked more, check-ins tended to be heavier.',
          receipt: `over ${Math.round(mid).toLocaleString()} steps: ${more.length} days · ${gap > 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} vs the rest`,
          weight: Math.min(1.2, 0.5 + Math.abs(gap) / 8)
        });
      }
    }
  }

  const compare = (pick: (d: BodyDay) => number | null) => {
    const all = month.map(pick).filter((v): v is number => v !== null);
    const week = month.filter(d => d.date >= weekFrom).map(pick).filter((v): v is number => v !== null);
    if (all.length < MIN_DAYS * 2 || week.length < MIN_DAYS) return null;
    return { usual: median(all), week: mean(week)!, n: week.length };
  };

  const hr = compare(d => d.restingHr);
  if (hr && hr.week - hr.usual >= HR_RISE) {
    out.push({
      key: 'resting-hr',
      text: 'Your resting heart rate has run higher than usual this week.',
      receipt: `${Math.round(hr.week)} bpm this week · usually ${Math.round(hr.usual)} · ${hr.n} days`,
      weight: 0.7
    });
  }
  const hrv = compare(d => d.hrv);
  if (hrv && hrv.week <= hrv.usual * (1 - HRV_DROP)) {
    out.push({
      key: 'hrv',
      text: 'Your heart-rate variability has run lower than usual this week.',
      receipt: `${Math.round(hrv.week)} ms this week · usually ${Math.round(hrv.usual)} · ${hrv.n} days`,
      weight: 0.7
    });
  }
  return out;
}
