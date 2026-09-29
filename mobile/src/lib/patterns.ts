import type { CheckIn } from './checkIns';
import { formatDuration, type SleepLog } from './sleep';
import type { Weather } from '@/theme/tokens';

/**
 * The first pattern engine (report §9): signals become plain facts on the
 * phone before anything is written about them. Every fact states its own
 * evidence and needs a minimum amount of it; nothing here predicts, diagnoses
 * or claims a cause — "tended to", never "because".
 *
 * Check-ins and hand-logged sleep feed it; health data joins later.
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

export type Reading = {
  headline: string;
  subtext: string;
  dos: readonly string[];
  donts: readonly string[];
};

const BY_WEATHER: Record<Weather, Omit<Reading, 'subtext'> & { fallback: string }> = {
  clear: {
    headline: 'Let it be easy.',
    fallback: 'Things have been light lately. Notice what’s helping, so you can find it again.',
    dos: ['Saying yes', 'Daylight', 'Starting something'],
    donts: ['Overbooking', 'Skipping rest', 'Dimming it']
  },
  mild: {
    headline: 'Keep the pace you’ve found.',
    fallback: 'Steady is its own kind of good. Nothing needs fixing today.',
    dos: ['Routine', 'A long walk', 'One tidy corner'],
    donts: ['Overplanning', 'Screens in bed', 'Rushing']
  },
  overcast: {
    headline: 'Go gently today.',
    fallback: 'Not bad, not bright. The kind of day that goes better with less asked of it.',
    dos: ['An early night', 'A friend’s voice', 'Something warm'],
    donts: ['Comparisons', 'Skipping meals', 'The news, twice']
  },
  fog: {
    headline: 'Small steps count.',
    fallback: 'Low and heavy lately. You don’t have to see far ahead — just the next small thing.',
    dos: ['Water', 'Ten minutes outside', 'One small task'],
    donts: ['Big decisions', 'Endless scrolling', 'Late nights']
  },
  storm: {
    headline: 'Put something down first.',
    fallback: 'A lot of charge, not much ease. Let it settle before you act on it.',
    dos: ['Slow breaths out', 'Moving your body', 'Writing it down'],
    donts: ['Sending that message', 'More caffeine', 'Arguing at night']
  }
};

/** For when readings are off, or there is nothing to read yet. */
export const GENERAL_READING: Reading = {
  headline: 'Notice one thing today.',
  subtext: 'How you slept, what you ate, who you talked to. Noticing is where patterns start.',
  dos: ['Checking in', 'Daylight', 'A slow breath'],
  donts: ['Rushing past it', 'Judging it', 'Keeping score']
};

export function buildReading(weather: Weather | null, leading: Fact | undefined): Reading {
  if (!weather) return GENERAL_READING;
  const base = BY_WEATHER[weather];
  return {
    headline: base.headline,
    subtext: leading && leading.key !== 'days' ? leading.text : base.fallback,
    dos: base.dos,
    donts: base.donts
  };
}

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
  opts: { personal: boolean; todayDate: string; now?: Date; sleep?: readonly SleepLog[] }
): Today {
  const now = opts.now ?? new Date();
  const sleep = opts.sleep ?? [];
  const checkedInToday = checkIns.some(c => c.localDate === opts.todayDate);
  const lastNight = sleep.find(l => l.wakeDate === opts.todayDate) ?? null;
  if (!opts.personal) return { weather: null, reading: GENERAL_READING, facts: [], checkedInToday, lastNight };

  const weather = innerWeather(checkIns, now);
  const found = [...facts(checkIns, now), ...sleepFacts(sleep, checkIns, now)].sort((a, b) => b.weight - a.weight);
  return { weather, reading: buildReading(weather, found[0]), facts: found, checkedInToday, lastNight };
}
