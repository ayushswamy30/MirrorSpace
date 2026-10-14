import type { CheckIn } from './checkIns';
import { generalReading, writeReading, type PageLike, type Reading } from './reading';
import { formatDuration, type SleepLog } from './sleep';
import type { Weather } from '@/theme/tokens';

/**
 * The first pattern engine (report §9): signals become plain facts on the
 * phone before anything is written about them. Every fact states its own
 * evidence and needs a minimum amount of it; nothing here predicts, diagnoses
 * or claims a cause — "tended to", never "because".
 *
 * Check-ins and sleep feed it; body signals join through `extra` (body.ts).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function within(checkIns: readonly CheckIn[], now: Date, days: number): CheckIn[] {
  const from = now.getTime() - days * DAY_MS;
  return checkIns.filter(c => {
    const t = new Date(c.createdAt).getTime();
    return t >= from && t <= now.getTime();
  });
}

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Inner Weather

/**
 * The last three days of check-ins, as weather. Pleasantness sets how bright
 * it is; energy tells a storm (charged and unpleasant) from fog (low and
 * unpleasant). Null until there is a check-in in that window.
 */
export function innerWeather(checkIns: readonly CheckIn[], now: Date = new Date()): Weather | null {
  return weatherOf(within(checkIns, now, 3));
}

/** Any set of check-ins as weather — the last three days, or a single day. */
export function weatherOf(checkIns: readonly CheckIn[]): Weather | null {
  if (checkIns.length === 0) return null;

  const p = mean(checkIns.map(c => c.pleasantness));
  const e = mean(checkIns.map(c => c.energy));

  if (p >= 2) return 'clear';
  if (p > 0) return 'mild';
  if (p > -2) return 'overcast';
  return e > 0 ? 'storm' : 'fog';
}

// ---------------------------------------------------------------------------
// Facts

export type Fact = {
  key: string;
  /** The claim, in the reading's voice. */
  text: string;
  /** Where it comes from, as a data line. */
  receipt: string;
  /** How much it says — the strongest fact leads. */
  weight: number;
};

const MIN_FOR_SHARE = 3;
const MIN_TAG_USES = 2;
const TAG_GAP = 2;

export function facts(checkIns: readonly CheckIn[], now: Date = new Date()): Fact[] {
  const week = within(checkIns, now, 7);
  const out: Fact[] = [];

  // How many days had a check-in — a count, never a streak.
  const days = new Set(week.map(c => c.localDate)).size;
  if (days > 0) {
    out.push({
      key: 'days',
      text: days === 1 ? 'You checked in on one day this week.' : `You checked in on ${days} of the last 7 days.`,
      receipt: `${week.length} check-in${week.length === 1 ? '' : 's'} · 7 days`,
      weight: 0
    });
  }

  if (week.length >= MIN_FOR_SHARE) {
    const low = week.filter(c => c.energy < 0).length;
    const unpleasant = week.filter(c => c.pleasantness < 0).length;
    const share = (n: number) => n / week.length;

    if (share(low) >= 0.6) {
      out.push({
        key: 'low-energy',
        text: `${low} of your last ${week.length} check-ins were low on energy.`,
        receipt: `${low}/${week.length} low energy · 7 days`,
        weight: share(low)
      });
    } else if (share(low) <= 0.2) {
      out.push({
        key: 'high-energy',
        text: `Most of this week has run on high energy — ${week.length - low} of ${week.length} check-ins.`,
        receipt: `${week.length - low}/${week.length} charged · 7 days`,
        weight: 1 - share(low)
      });
    }

    if (share(unpleasant) >= 0.6) {
      out.push({
        key: 'unpleasant',
        text: `It’s been a heavier week: ${unpleasant} of ${week.length} check-ins leaned unpleasant.`,
        receipt: `${unpleasant}/${week.length} unpleasant · 7 days`,
        weight: share(unpleasant) + 0.1
      });
    } else if (share(unpleasant) <= 0.2) {
      out.push({
        key: 'pleasant',
        text: `A lighter week: ${week.length - unpleasant} of ${week.length} check-ins leaned pleasant.`,
        receipt: `${week.length - unpleasant}/${week.length} pleasant · 7 days`,
        weight: 1 - share(unpleasant)
      });
    }

    // A tag whose check-ins sit well apart from the rest.
    const tags = new Set(week.flatMap(c => c.tags));
    let best: Fact | null = null;
    for (const tag of tags) {
      const tagged = week.filter(c => c.tags.includes(tag));
      const others = week.filter(c => !c.tags.includes(tag));
      if (tagged.length < MIN_TAG_USES || others.length === 0) continue;
      const gap = mean(tagged.map(c => c.pleasantness)) - mean(others.map(c => c.pleasantness));
      if (Math.abs(gap) < TAG_GAP) continue;
      const fact: Fact = {
        key: `tag-${tag}`,
        text:
          gap < 0
            ? `Check-ins tagged “${tag}” tended to be heavier than the rest.`
            : `Check-ins tagged “${tag}” tended to be lighter than the rest.`,
        receipt: `${tag}: ${tagged.length} check-ins · ${gap > 0 ? '+' : ''}${gap.toFixed(1)} vs others`,
        weight: Math.min(1.5, Math.abs(gap) / 4 + tagged.length / 10)
      };
      if (!best || fact.weight > best.weight) best = fact;
    }
    if (best) out.push(best);
  }

  return out.sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// Sleep

const SHORT_NIGHT_MIN = 6 * 60;
const MIN_NIGHTS_FOR_AVERAGE = 3;
const MIN_PAIRS = 2;
const SLEEP_GAP = 1.5;

function sleepSince(logs: readonly SleepLog[], now: Date, days: number): SleepLog[] {
  const from = now.getTime() - days * DAY_MS;
  return logs.filter(l => {
    const t = new Date(l.wakeAt).getTime();
    return t >= from && t <= now.getTime();
  });
}

export function sleepFacts(logs: readonly SleepLog[], checkIns: readonly CheckIn[], now: Date = new Date()): Fact[] {
  const out: Fact[] = [];

  const week = sleepSince(logs, now, 7);
  if (week.length >= MIN_NIGHTS_FOR_AVERAGE) {
    const avg = Math.round(mean(week.map(l => l.minutes)));
    out.push({
      key: 'sleep-average',
      text: `You slept ${formatDuration(avg)} a night on average this week.`,
      receipt: `avg ${formatDuration(avg)} · ${week.length} nights`,
      weight: avg < SHORT_NIGHT_MIN ? 0.8 : 0.3
    });
  }

  // Each check-in paired with the night that ended its day.
  const byMorning = new Map(sleepSince(logs, now, 30).map(l => [l.wakeDate, l]));
  const after = within(checkIns, now, 30).filter(c => byMorning.has(c.localDate));
  const short = after.filter(c => byMorning.get(c.localDate)!.minutes < SHORT_NIGHT_MIN);
  const rest = after.filter(c => byMorning.get(c.localDate)!.minutes >= SHORT_NIGHT_MIN);
  if (short.length >= MIN_PAIRS && rest.length >= MIN_PAIRS) {
    const gap = mean(short.map(c => c.pleasantness)) - mean(rest.map(c => c.pleasantness));
    if (gap <= -SLEEP_GAP) {
      out.push({
        key: 'short-sleep',
        text: 'After nights under 6 hours, your check-ins tended to be heavier.',
        receipt: `${short.length} check-ins after short nights · ${gap.toFixed(1)} vs others · 30 days`,
        weight: Math.min(1.4, 0.7 + Math.abs(gap) / 8)
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// The reading

export { GENERAL_READING, type Reading } from './reading';

export type Today = {
  weather: Weather | null;
  reading: Reading;
  facts: Fact[];
  checkedInToday: boolean;
  /** The night that ended this morning, if it has been logged. */
  lastNight: SleepLog | null;
};

/**
 * Everything the Today screen shows. With readings consent off, the reading
 * is the general one and there is no weather — as the consent screen says.
 * Last night's log is shown either way: it is the person's own entry, not a
 * reading.
 */
export function today(
  checkIns: readonly CheckIn[],
  opts: {
    personal: boolean;
    todayDate: string;
    now?: Date;
    sleep?: readonly SleepLog[];
    /** Facts found elsewhere on the phone — the body's, from Health Connect. */
    extra?: readonly Fact[];
    /** Pages kept, so the reading can know what has been on their mind. */
    pages?: readonly PageLike[];
    /** Whose day it is (the account id): two people never read the same. */
    seed?: string;
  }
): Today {
  const now = opts.now ?? new Date();
  const sleep = opts.sleep ?? [];
  const checkedInToday = checkIns.some(c => c.localDate === opts.todayDate);
  const lastNight = sleep.find(l => l.wakeDate === opts.todayDate) ?? null;
  const seed = opts.seed ?? '';
  if (!opts.personal) {
    return { weather: null, reading: generalReading(seed, opts.todayDate), facts: [], checkedInToday, lastNight };
  }

  const weather = innerWeather(checkIns, now);
  const found = [...facts(checkIns, now), ...sleepFacts(sleep, checkIns, now), ...(opts.extra ?? [])].sort(
    (a, b) => b.weight - a.weight
  );
  const reading = writeReading({
    weather,
    facts: found,
    checkIns: checkIns.filter(c => new Date(c.createdAt).getTime() <= now.getTime()),
    sleep,
    lastNight,
    pages: (opts.pages ?? []).filter(p => new Date(p.createdAt).getTime() <= now.getTime()),
    now,
    date: opts.todayDate,
    seed
  });
  return { weather, reading, facts: found, checkedInToday, lastNight };
}
