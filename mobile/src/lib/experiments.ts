import * as Crypto from 'expo-crypto';

import { localDate, type CheckIn } from './checkIns';
import { getDatabase } from './db/database';
import { formatDuration, type SleepLog } from './sleep';

/**
 * Personal experiments (report §5): a seven-day trial of one small change —
 * "no phone after 22:00" — and afterwards, the week before set beside the
 * week of it, on the person's own check-ins and nights. Kept only on the
 * phone. It shows what changed alongside the experiment; it can't say the
 * experiment caused it, and says so.
 */

export const EXPERIMENT_DAYS = 7;

export const PRESETS = [
  'No phone after 22:00',
  'In bed by 23:30',
  'Ten minutes outside each morning',
  'No caffeine after 14:00',
  'A walk after lunch',
  'One page written each evening'
] as const;

export type Experiment = {
  id: string;
  title: string;
  /** The first day, YYYY-MM-DD. */
  startsOn: string;
  /** The last day, inclusive. */
  endsOn: string;
  /** The days the person said they kept it. */
  kept: string[];
  /** Set when stopped before its seventh day. */
  stoppedOn: string | null;
};

// Today shows the running experiment; it hears when one starts or changes.
const listeners = new Set<() => void>();

export function onExperimentsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed(): void {
  for (const listener of listeners) listener();
}

type Row = { id: string; title: string; starts_on: string; ends_on: string; kept: string; stopped_on: string | null };

function fromRow(r: Row): Experiment {
  return { id: r.id, title: r.title, startsOn: r.starts_on, endsOn: r.ends_on, kept: JSON.parse(r.kept) as string[], stoppedOn: r.stopped_on };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** Running, finished, or stopped early — as of `today`. */
export function stateOf(e: Experiment, today: string): 'running' | 'finished' | 'stopped' {
  if (e.stoppedOn) return 'stopped';
  return today > e.endsOn ? 'finished' : 'running';
}

/** 1 on the first day; never past the seventh. */
export function dayOf(e: Experiment, today: string): number {
  const ms = new Date(`${today}T12:00:00`).getTime() - new Date(`${e.startsOn}T12:00:00`).getTime();
  return Math.min(EXPERIMENT_DAYS, Math.max(1, Math.round(ms / 86_400_000) + 1));
}

export async function listExperiments(): Promise<Experiment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>('SELECT * FROM experiments ORDER BY starts_on DESC, created_at DESC');
  return rows.map(fromRow);
}

export async function startExperiment(title: string, now: Date = new Date()): Promise<Experiment> {
  const startsOn = localDate(now);
  const experiment: Experiment = {
    id: Crypto.randomUUID(),
    title: title.trim(),
    startsOn,
    endsOn: addDays(startsOn, EXPERIMENT_DAYS - 1),
    kept: [],
    stoppedOn: null
  };
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO experiments (id, created_at, title, starts_on, ends_on) VALUES (?, ?, ?, ?, ?)',
    experiment.id,
    now.toISOString(),
    experiment.title,
    experiment.startsOn,
    experiment.endsOn
  );
  changed();
  return experiment;
}

/** Marks a day kept, or not — tapping again takes it back. */
export async function setKept(e: Experiment, date: string, kept: boolean): Promise<Experiment> {
  const next = kept ? [...new Set([...e.kept, date])].sort() : e.kept.filter(d => d !== date);
  const db = await getDatabase();
  await db.runAsync('UPDATE experiments SET kept = ? WHERE id = ?', JSON.stringify(next), e.id);
  changed();
  return { ...e, kept: next };
}

export async function stopExperiment(e: Experiment, now: Date = new Date()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE experiments SET stopped_on = ? WHERE id = ?', localDate(now), e.id);
  changed();
}

export async function deleteExperiment(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM experiments WHERE id = ?', id);
  changed();
}

// ---------------------------------------------------------------------------
// Before and during

const MIN_CHECK_INS = 3;
const MIN_NIGHTS = 3;
const MOOD_GAP = 1;
const SLEEP_GAP_MIN = 20;

export type Side = { checkIns: number; mood: number | null; energy: number | null; nights: number; sleep: number | null };

export type Comparison = {
  before: Side;
  during: Side;
  /** Plain lines about what changed alongside it; empty when too little was logged. */
  lines: string[];
  kept: number;
  days: number;
};

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function side(checkIns: readonly CheckIn[], sleep: readonly SleepLog[], from: string, to: string): Side {
  const list = checkIns.filter(c => c.localDate >= from && c.localDate <= to);
  const nights = sleep.filter(l => l.wakeDate >= from && l.wakeDate <= to);
  return {
    checkIns: list.length,
    mood: mean(list.map(c => c.pleasantness)),
    energy: mean(list.map(c => c.energy)),
    nights: nights.length,
    sleep: nights.length ? Math.round(mean(nights.map(l => l.minutes))!) : null
  };
}

export function compare(e: Experiment, checkIns: readonly CheckIn[], sleep: readonly SleepLog[], today: string): Comparison {
  const last = e.stoppedOn && e.stoppedOn < e.endsOn ? e.stoppedOn : e.endsOn < today ? e.endsOn : today;
  const days = dayOf(e, last);
  const before = side(checkIns, sleep, addDays(e.startsOn, -EXPERIMENT_DAYS), addDays(e.startsOn, -1));
  // Nights are named by their morning: the first night of the experiment ends on day 2.
  const during = side(checkIns, sleep, e.startsOn, last);
  const duringNights = side([], sleep, addDays(e.startsOn, 1), addDays(last, 1));

  const lines: string[] = [];
  if (before.checkIns >= MIN_CHECK_INS && during.checkIns >= MIN_CHECK_INS) {
    const gap = during.mood! - before.mood!;
    const egap = during.energy! - before.energy!;
    if (gap >= MOOD_GAP) lines.push(`Check-ins ran lighter during it (${signed(gap)} vs the week before).`);
    else if (gap <= -MOOD_GAP) lines.push(`Check-ins ran heavier during it (${signed(gap)} vs the week before).`);
    else lines.push('Check-ins ran about the same as the week before.');
    if (Math.abs(egap) >= MOOD_GAP) lines.push(`Energy ran ${egap > 0 ? 'higher' : 'lower'} (${signed(egap)}).`);
  }
  if (before.nights >= MIN_NIGHTS && duringNights.nights >= MIN_NIGHTS) {
    const gap = duringNights.sleep! - before.sleep!;
    if (Math.abs(gap) >= SLEEP_GAP_MIN) {
      lines.push(
        `Nights averaged ${formatDuration(duringNights.sleep!)}, against ${formatDuration(before.sleep!)} the week before.`
      );
    } else lines.push(`Nights stayed about the same, around ${formatDuration(duringNights.sleep!)}.`);
  }

  return { before, during: { ...during, nights: duringNights.nights, sleep: duringNights.sleep }, lines, kept: e.kept.filter(d => d <= last).length, days };
}

function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;
}
