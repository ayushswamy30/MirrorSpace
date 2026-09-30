import { localDate, type CheckIn } from './checkIns';
import { weatherOf } from './patterns';
import type { SleepLog } from './sleep';
import type { Weather } from '@/theme/tokens';

/**
 * The Chart tab's tables (day 7 on): the person's own data laid out, no
 * reading written over it. Everything is computed on the phone.
 */

export type ChartDay = { date: string; weather: Weather | null; checkIns: number };

/** One entry per calendar day, oldest first, ending today. */
export function dailyWeather(checkIns: readonly CheckIn[], now: Date = new Date(), days = 30): ChartDay[] {
  const byDate = new Map<string, CheckIn[]>();
  for (const c of checkIns) byDate.set(c.localDate, [...(byDate.get(c.localDate) ?? []), c]);

  const out: ChartDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const list = byDate.get(date) ?? [];
    out.push({ date, weather: weatherOf(list), checkIns: list.length });
  }
  return out;
}

function since(checkIns: readonly CheckIn[], now: Date, days: number): CheckIn[] {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return checkIns.filter(c => new Date(c.createdAt) >= from);
}

export type WordCount = { word: string; count: number };

export function topWords(checkIns: readonly CheckIn[], now: Date = new Date(), limit = 5): WordCount[] {
  const counts = new Map<string, number>();
  for (const c of since(checkIns, now, 30)) counts.set(c.emotion, (counts.get(c.emotion) ?? 0) + 1);
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

export type TagRow = { tag: string; count: number; lean: 'lighter' | 'heavier' | 'even' };

/** How days with each tag compare with the rest. "Even" unless the gap is clear. */
export function tagTable(checkIns: readonly CheckIn[], now: Date = new Date()): TagRow[] {
  const recent = since(checkIns, now, 30);
  const tags = new Set(recent.flatMap(c => c.tags));
  const avg = (list: CheckIn[]) => list.reduce((s, c) => s + c.pleasantness, 0) / list.length;

  return [...tags]
    .map(tag => {
      const tagged = recent.filter(c => c.tags.includes(tag));
      const others = recent.filter(c => !c.tags.includes(tag));
      const gap = others.length ? avg(tagged) - avg(others) : 0;
      const lean: TagRow['lean'] = tagged.length < 2 || Math.abs(gap) < 1.5 ? 'even' : gap > 0 ? 'lighter' : 'heavier';
      return { tag, count: tagged.length, lean };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export type NightsSummary = { nights: number; averageMinutes: number; shortNights: number } | null;

export function nightsSummary(logs: readonly SleepLog[], now: Date = new Date()): NightsSummary {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const recent = logs.filter(l => new Date(l.wakeAt) >= from);
  if (recent.length === 0) return null;
  return {
    nights: recent.length,
    averageMinutes: Math.round(recent.reduce((s, l) => s + l.minutes, 0) / recent.length),
    shortNights: recent.filter(l => l.minutes < 6 * 60).length
  };
}

/** Minutes slept each night, oldest first, ending last night; null where none was logged. */
export function nightly(logs: readonly SleepLog[], now: Date = new Date(), days = 30): (number | null)[] {
  const byDate = new Map(logs.map(l => [l.wakeDate, l.minutes]));
  const out: (number | null)[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(byDate.get(localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))) ?? null);
  }
  return out;
}

/** The weather most days had, and how many; null before any check-in. Ties go to the lighter sky. */
export function mostlyWeather(days: readonly ChartDay[]): { weather: Weather; days: number } | null {
  const counts = new Map<Weather, number>();
  for (const d of days) if (d.weather) counts.set(d.weather, (counts.get(d.weather) ?? 0) + 1);
  let best: { weather: Weather; days: number } | null = null;
  for (const weather of Object.keys(WEATHER_INK) as Weather[]) {
    const n = counts.get(weather) ?? 0;
    if (n > 0 && (!best || n > best.days)) best = { weather, days: n };
  }
  return best;
}

/** Weather as ink density, lightest to heaviest — the chart stays monochrome. */
export const WEATHER_INK: Record<Weather, number> = {
  clear: 0,
  mild: 0.25,
  overcast: 0.5,
  fog: 0.75,
  storm: 1
};
