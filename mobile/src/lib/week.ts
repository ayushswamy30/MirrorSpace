import { tagTable, topWords, type TagRow, type WordCount } from './chart';
import { localDate, type CheckIn } from './checkIns';
import { weatherOf } from './patterns';
import type { WeekStart } from './preferences';
import { formatDuration, type SleepLog } from './sleep';
import type { Weather } from '@/theme/tokens';

/**
 * The week in reflection (report: "Sunday 'week in reflection'"): the seven
 * days ending today, laid out — their weather, the lightest and heaviest,
 * the words, what surrounded them and the nights. Days without a check-in
 * are "quiet days", never a broken chain.
 */

export type WeekDay = { date: string; weekday: string; weather: Weather | null; mood: number | null };

export type WeekReflection = {
  days: WeekDay[];
  checkedIn: number;
  quiet: number;
  mostly: Weather | null;
  lightest: WeekDay | null;
  heaviest: WeekDay | null;
  words: WordCount[];
  tags: TagRow[];
  nights: { count: number; average: number | null; shortest: SleepLog | null };
  summary: string;
};

const ORDER: Weather[] = ['clear', 'mild', 'overcast', 'fog', 'storm'];

export function weekReflection(checkIns: readonly CheckIn[], sleep: readonly SleepLog[], now: Date = new Date()): WeekReflection {
  const dates = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i));
  const days: WeekDay[] = dates.map(d => {
    const own = checkIns.filter(c => c.localDate === localDate(d));
    return {
      date: localDate(d),
      weekday: d.toLocaleDateString([], { weekday: 'long' }),
      weather: weatherOf(own),
      mood: own.length ? own.reduce((s, c) => s + c.pleasantness, 0) / own.length : null
    };
  });

  const known = days.filter(d => d.mood !== null);
  const sorted = [...known].sort((a, b) => (a.mood ?? 0) - (b.mood ?? 0));
  const counts = new Map<Weather, number>();
  for (const d of days) if (d.weather) counts.set(d.weather, (counts.get(d.weather) ?? 0) + 1);
  let mostly: Weather | null = null;
  for (const w of ORDER) if ((counts.get(w) ?? 0) > (mostly ? counts.get(mostly)! : 0)) mostly = w;

  const weekStart = localDate(dates[0]);
  const inWeek = checkIns.filter(c => c.localDate >= weekStart && c.localDate <= localDate(now));
  const nights = sleep.filter(l => l.wakeDate >= weekStart && l.wakeDate <= localDate(now));
  const average = nights.length ? Math.round(nights.reduce((s, l) => s + l.minutes, 0) / nights.length) : null;

  const lightest = known.length > 1 ? sorted[sorted.length - 1] : null;
  const heaviest = known.length > 1 && sorted[0] !== lightest ? sorted[0] : null;

  return {
    days,
    checkedIn: known.length,
    quiet: 7 - known.length,
    mostly,
    lightest,
    heaviest,
    words: topWords(inWeek, now, 3),
    tags: tagTable(inWeek, now).slice(0, 3),
    nights: { count: nights.length, average, shortest: nights.length ? [...nights].sort((a, b) => a.minutes - b.minutes)[0] : null },
    summary: summarise(mostly, heaviest, lightest, average, known.length)
  };
}

function summarise(mostly: Weather | null, heaviest: WeekDay | null, lightest: WeekDay | null, average: number | null, checkedIn: number): string {
  if (checkedIn === 0) return 'A quiet week — nothing was written down, and that’s allowed.';
  const parts = [mostly ? `Mostly ${mostly}` : 'A mixed week'];
  if (heaviest) parts.push(`${heaviest.weekday} the heaviest`);
  if (lightest) parts.push(`${lightest.weekday} the lightest`);
  const first = `${parts.join(', ')}.`;
  return average ? `${first} Nights averaged ${formatDuration(average)}.` : first;
}

/** The week's last day for the chosen start: the day the reflection is offered. */
export function isWeekEnd(day: Date, weekStart: WeekStart): boolean {
  return day.getDay() === (weekStart === 'monday' ? 0 : 6);
}
