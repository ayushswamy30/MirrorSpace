import { localDate, type CheckIn } from './checkIns';
import { formatClock, formatDuration, type SleepLog } from './sleep';

/**
 * The Mind Forecast (report §5): a short outlook for tomorrow, framed as
 * weather — never a prediction of illness. It reads three things against the
 * person's own baseline, each with its receipt:
 *
 * - the last three days against the two weeks before them
 * - the last few nights: later than usual (the strongest signal in the
 *   research the report cites), or short
 * - how tomorrow's weekday has tended to go
 *
 * One signal on its own is shown as "may", never "will"; with nothing to go
 * on there is no forecast at all.
 */

export type Outlook = 'lighter' | 'steady' | 'heavier';

export type Signal = { lean: 'lighter' | 'heavier'; text: string; receipt: string };

export type Forecast = { outlook: Outlook; title: string; line: string; signals: Signal[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_GAP = 1.5;
const LATE_BY_MIN = 60;
const SHORT_NIGHT = 6 * 60;
const WEEKDAY_GAP = 1.5;
const MIN_WEEKDAY_DAYS = 3;

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function dayStart(now: Date, back: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
}

function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;
}

/** Bedtime as minutes from noon, so 23:00 is −60 and 01:00 is +60. */
function bedAround(log: SleepLog): number {
  const d = new Date(log.bedAt);
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= 12 * 60 ? m - 1440 : m;
}

export function trendSignal(checkIns: readonly CheckIn[], now: Date): Signal | null {
  const recentFrom = localDate(dayStart(now, 2));
  const baseFrom = localDate(dayStart(now, 16));
  const recent = checkIns.filter(c => c.localDate >= recentFrom && c.localDate <= localDate(now));
  const base = checkIns.filter(c => c.localDate >= baseFrom && c.localDate < recentFrom);
  if (recent.length < 3 || base.length < 5) return null;

  const gap = mean(recent.map(c => c.pleasantness)) - mean(base.map(c => c.pleasantness));
  const receipt = `last 3 days ${signed(gap)} vs the 2 weeks before · ${recent.length} + ${base.length} check-ins`;
  if (gap <= -TREND_GAP) return { lean: 'heavier', text: 'The last three days have run heavier than your usual.', receipt };
  if (gap >= TREND_GAP) return { lean: 'lighter', text: 'The last three days have run lighter than your usual.', receipt };
  return null;
}

export function nightsSignal(sleep: readonly SleepLog[], now: Date): Signal | null {
  const from = now.getTime() - 30 * DAY_MS;
  const month = sleep.filter(l => new Date(l.wakeAt).getTime() >= from && new Date(l.wakeAt).getTime() <= now.getTime());
  const lastThree = month.filter(l => l.wakeDate >= localDate(dayStart(now, 2)));
  if (month.length < 7 || lastThree.length < 2) return null;

  const usual = median(month.map(bedAround));
  const recent = mean(lastThree.map(bedAround));
  const clock = (around: number) => formatClock(((Math.round(around / 5) * 5) + 1440) % 1440);
  if (recent - usual >= LATE_BY_MIN) {
    return {
      lean: 'heavier',
      text: 'Your last few nights started later than usual.',
      receipt: `asleep ~${clock(recent)} lately · usually ~${clock(usual)} · ${month.length} nights`
    };
  }
  const short = lastThree.filter(l => l.minutes < SHORT_NIGHT);
  if (short.length >= 2) {
    return {
      lean: 'heavier',
      text: `${short.length} of your last ${lastThree.length} nights were under 6 hours.`,
      receipt: `${lastThree.map(l => formatDuration(l.minutes)).join(' · ')}`
    };
  }
  return null;
}

export function weekdaySignal(checkIns: readonly CheckIn[], now: Date): Signal | null {
  const from = localDate(dayStart(now, 90));
  const recent = checkIns.filter(c => c.localDate >= from);
  if (recent.length < 10) return null;

  const tomorrow = dayStart(now, -1).getDay();
  const days = new Map<string, number[]>();
  for (const c of recent) days.set(c.localDate, [...(days.get(c.localDate) ?? []), c.pleasantness]);
  const moods = [...days.entries()].map(([date, ps]) => ({ day: new Date(`${date}T12:00:00`).getDay(), mood: mean(ps) }));
  const on = moods.filter(m => m.day === tomorrow);
  if (on.length < MIN_WEEKDAY_DAYS) return null;

  const gap = mean(on.map(m => m.mood)) - mean(moods.map(m => m.mood));
  const name = dayStart(now, -1).toLocaleDateString([], { weekday: 'long' });
  const receipt = `${name}s ${signed(gap)} vs your average · ${on.length} ${name}s`;
  if (gap <= -WEEKDAY_GAP) return { lean: 'heavier', text: `${name}s have tended to run heavier for you.`, receipt };
  if (gap >= WEEKDAY_GAP) return { lean: 'lighter', text: `${name}s have tended to run lighter for you.`, receipt };
  return null;
}

export function forecast(checkIns: readonly CheckIn[], sleep: readonly SleepLog[], now: Date = new Date()): Forecast | null {
  const signals = [trendSignal(checkIns, now), nightsSignal(sleep, now), weekdaySignal(checkIns, now)].filter(
    (s): s is Signal => s !== null
  );
  if (signals.length === 0) return null;

  const net = signals.filter(s => s.lean === 'lighter').length - signals.filter(s => s.lean === 'heavier').length;
  if (net === 0) {
    return { outlook: 'steady', title: 'Tomorrow looks mixed.', line: 'Some signs point lighter, some heavier. Take it as it comes.', signals };
  }
  const sure = Math.abs(net) >= 2;
  if (net < 0) {
    return {
      outlook: 'heavier',
      title: sure ? 'Tomorrow looks heavy.' : 'Tomorrow may run heavier.',
      line: 'Worth keeping it light where you can — an early night tonight, one less thing tomorrow.',
      signals
    };
  }
  return {
    outlook: 'lighter',
    title: sure ? 'Tomorrow looks lighter.' : 'Tomorrow may run lighter.',
    line: 'A good day to start something, if you want to.',
    signals
  };
}
