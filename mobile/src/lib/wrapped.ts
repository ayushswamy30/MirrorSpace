import { localDate, type CheckIn } from './checkIns';
import { leans, type TagLean } from './mindChart';
import { weatherOf } from './patterns';
import { formatDuration, type SleepLog } from './sleep';
import type { Weather } from '@/theme/tokens';

/**
 * Wrapped (report §5, day 30): a month or a year told back as a short story —
 * how many days had a word in them, the weather they made, the word reached
 * for most, the lightest day of the week, what restored and what drained,
 * the nights, and the pages kept. Counts and plain facts only, on the phone.
 * Quiet days are counted, never mourned; there are no streaks here either.
 */

export type WrappedPeriod = 'this-month' | 'last-month' | 'this-year';

export type Span = { period: WrappedPeriod; from: string; to: string; label: string };

export type Wrapped = {
  span: Span;
  /** Calendar days in the span so far. */
  days: number;
  checkedIn: number;
  checkIns: number;
  mostly: { weather: Weather; days: number } | null;
  word: { word: string; count: number } | null;
  lightestWeekday: string | null;
  restorer: TagLean | null;
  drain: TagLean | null;
  nights: { count: number; average: number; longest: SleepLog } | null;
  /** For a year: the month with the longest average nights, with at least five logged. */
  bestRested: { month: string; average: number } | null;
  /** For a year: the month whose check-ins ran lightest, with at least five. */
  lightestMonth: string | null;
  pages: number;
};

const ORDER: Weather[] = ['clear', 'mild', 'overcast', 'fog', 'storm'];
const MIN_WEEKDAY = 2;
const MIN_MONTH = 5;

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function monthName(yyyyMm: string): string {
  return new Date(`${yyyyMm}-15T12:00:00`).toLocaleDateString([], { month: 'long' });
}

export function spanOf(period: WrappedPeriod, now: Date = new Date()): Span {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'this-year') {
    return { period, from: `${y}-01-01`, to: localDate(now), label: String(y) };
  }
  if (period === 'last-month') {
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return { period, from: localDate(first), to: localDate(last), label: monthName(localDate(first).slice(0, 7)) };
  }
  return { period, from: localDate(new Date(y, m, 1)), to: localDate(now), label: monthName(localDate(now).slice(0, 7)) };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export function wrapped(
  checkIns: readonly CheckIn[],
  sleep: readonly SleepLog[],
  pageDates: readonly string[],
  span: Span
): Wrapped {
  const inSpan = (date: string) => date >= span.from && date <= span.to;
  const list = checkIns.filter(c => inSpan(c.localDate));
  const nights = sleep.filter(l => inSpan(l.wakeDate));

  const byDate = new Map<string, CheckIn[]>();
  for (const c of list) byDate.set(c.localDate, [...(byDate.get(c.localDate) ?? []), c]);

  const weatherCounts = new Map<Weather, number>();
  for (const day of byDate.values()) {
    const w = weatherOf(day);
    if (w) weatherCounts.set(w, (weatherCounts.get(w) ?? 0) + 1);
  }
  let mostly: Wrapped['mostly'] = null;
  for (const w of ORDER) {
    const n = weatherCounts.get(w) ?? 0;
    if (n > 0 && (!mostly || n > mostly.days)) mostly = { weather: w, days: n };
  }

  // Each day's mood, then the weekdays' averages over those days.
  const weekdays = new Map<string, number[]>();
  for (const [date, day] of byDate) {
    const name = new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'long' });
    weekdays.set(name, [...(weekdays.get(name) ?? []), mean(day.map(c => c.pleasantness))]);
  }
  const weekdayRanks = [...weekdays.entries()]
    .filter(([, moods]) => moods.length >= MIN_WEEKDAY)
    .map(([name, moods]) => ({ name, mood: mean(moods) }))
    .sort((a, b) => b.mood - a.mood);

  const { restorers, drains } = leans(list);

  const months = new Map<string, { sleep: number[]; moods: number[] }>();
  const month = (key: string) => {
    if (!months.has(key)) months.set(key, { sleep: [], moods: [] });
    return months.get(key)!;
  };
  for (const l of nights) month(l.wakeDate.slice(0, 7)).sleep.push(l.minutes);
  for (const c of list) month(c.localDate.slice(0, 7)).moods.push(c.pleasantness);
  const year = span.period === 'this-year';
  const rested = [...months.entries()]
    .filter(([, v]) => v.sleep.length >= MIN_MONTH)
    .map(([key, v]) => ({ month: monthName(key), average: Math.round(mean(v.sleep)) }))
    .sort((a, b) => b.average - a.average);
  const lighter = [...months.entries()]
    .filter(([, v]) => v.moods.length >= MIN_MONTH)
    .map(([key, v]) => ({ month: monthName(key), mood: mean(v.moods) }))
    .sort((a, b) => b.mood - a.mood);

  return {
    span,
    days: daysBetween(span.from, span.to),
    checkedIn: byDate.size,
    checkIns: list.length,
    mostly,
    word: topWordOf(list),
    lightestWeekday: weekdayRanks.length >= 2 ? weekdayRanks[0].name : null,
    restorer: restorers[0] ?? null,
    drain: drains[0] ?? null,
    nights: nights.length
      ? {
          count: nights.length,
          average: Math.round(mean(nights.map(l => l.minutes))),
          longest: [...nights].sort((a, b) => b.minutes - a.minutes)[0]
        }
      : null,
    bestRested: year && rested.length >= 2 ? rested[0] : null,
    lightestMonth: year && lighter.length >= 2 ? lighter[0].month : null,
    pages: pageDates.filter(inSpan).length
  };
}

function topWordOf(list: readonly CheckIn[]): Wrapped['word'] {
  const counts = new Map<string, number>();
  for (const c of list) counts.set(c.emotion, (counts.get(c.emotion) ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return best ? { word: best[0], count: best[1] } : null;
}

export type StoryLine = { key: string; label: string; title: string; line?: string };

/** The story, in order: one plain statement at a time. */
export function storyOf(w: Wrapped): StoryLine[] {
  if (w.checkedIn === 0) {
    return [{ key: 'quiet', label: w.span.label, title: 'A quiet stretch.', line: 'Nothing was written down, and that’s allowed.' }];
  }
  const quiet = w.days - w.checkedIn;
  const out: StoryLine[] = [
    {
      key: 'days',
      label: 'days',
      title: `${w.checkedIn} ${w.checkedIn === 1 ? 'day' : 'days'} with a word in ${w.checkedIn === 1 ? 'it' : 'them'}.`,
      line: quiet > 0 ? `And ${quiet} quiet ${quiet === 1 ? 'one' : 'ones'} — those count too.` : 'Every single day.'
    }
  ];
  if (w.mostly) {
    out.push({ key: 'weather', label: 'the weather', title: `Mostly ${w.mostly.weather}.`, line: `${w.mostly.days} of ${w.checkedIn} days.` });
  }
  if (w.word) {
    out.push({
      key: 'word',
      label: 'your word',
      title: `“${w.word.word}”`,
      line: w.word.count === 1 ? 'Reached for once.' : `Reached for ${w.word.count} times.`
    });
  }
  if (w.lightestWeekday) {
    out.push({ key: 'weekday', label: 'lightest day', title: `${w.lightestWeekday}s.`, line: 'Your check-ins ran lightest then.' });
  }
  if (w.lightestMonth) {
    out.push({ key: 'month', label: 'lightest month', title: `${w.lightestMonth}.`, line: 'The month your check-ins ran lightest.' });
  }
  if (w.restorer) {
    out.push({ key: 'restorer', label: 'what restored', title: w.restorer.tag, line: `Check-ins tagged “${w.restorer.tag}” ran lighter than the rest.` });
  }
  if (w.drain) {
    out.push({ key: 'drain', label: 'what drained', title: w.drain.tag, line: `Check-ins tagged “${w.drain.tag}” ran heavier than the rest.` });
  }
  if (w.nights) {
    out.push({
      key: 'nights',
      label: 'nights',
      title: `${formatDuration(w.nights.average)} a night.`,
      line: `${w.nights.count} ${w.nights.count === 1 ? 'night' : 'nights'} logged · longest ${formatDuration(w.nights.longest.minutes)}`
    });
  }
  if (w.bestRested) {
    out.push({ key: 'rested', label: 'best rested', title: `${w.bestRested.month}.`, line: `${formatDuration(w.bestRested.average)} a night, on average.` });
  }
  if (w.pages > 0) {
    out.push({ key: 'pages', label: 'pages kept', title: `${w.pages} ${w.pages === 1 ? 'page' : 'pages'}.`, line: 'Written down, and kept.' });
  }
  return out;
}
