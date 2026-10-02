import { localDate, type CheckIn } from './checkIns';
import { weatherOf } from './patterns';
import { formatDuration, type SleepLog } from './sleep';

/**
 * The day by area (report: "Inner Weather: Mind, Body, Social battery,
 * Focus"), each a level from 1 to 5 with the receipt it came from. An area
 * without enough to go on says so; it is never filled in with a guess.
 */

export type Area = 'mind' | 'body' | 'battery' | 'focus';

export type AreaReading = {
  area: Area;
  label: string;
  /** 1–5, or null when there's nothing to read it from. */
  level: number | null;
  receipt: string;
};

const DAY = 24 * 60 * 60 * 1000;
const PEOPLE = ['family', 'partner', 'friends'];
const WORK = ['work', 'study'];

function recent(checkIns: readonly CheckIn[], now: Date, days: number): CheckIn[] {
  return checkIns.filter(c => now.getTime() - new Date(c.createdAt).getTime() < days * DAY && new Date(c.createdAt) <= now);
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** -5…5 onto 1…5. */
function level(score: number): number {
  return Math.min(5, Math.max(1, Math.round((score + 5) / 2.5) + 1));
}

const count = (n: number) => `${n} check-in${n === 1 ? '' : 's'}`;

export function glance(checkIns: readonly CheckIn[], sleep: readonly SleepLog[], now: Date = new Date()): AreaReading[] {
  const three = recent(checkIns, now, 3);
  const week = recent(checkIns, now, 7);

  const mind: AreaReading = three.length
    ? { area: 'mind', label: 'mind', level: level(mean(three.map(c => c.pleasantness))), receipt: `how ${count(three.length)} felt · 3 days` }
    : { area: 'mind', label: 'mind', level: null, receipt: 'one check-in fills this in' };

  const night = sleep.find(l => l.wakeDate === localDate(now));
  const body: AreaReading = night
    ? {
        area: 'body',
        label: 'body',
        level: night.minutes < 300 ? 1 : night.minutes < 360 ? 2 : night.minutes < 420 ? 3 : night.minutes < 480 ? 4 : 5,
        receipt: `${formatDuration(night.minutes)} last night`
      }
    : { area: 'body', label: 'body', level: null, receipt: 'log last night to see this' };

  const withPeople = week.filter(c => c.tags.some(t => PEOPLE.includes(t)));
  const batterySource = withPeople.length ? withPeople : three;
  const battery: AreaReading = batterySource.length
    ? {
        area: 'battery',
        label: 'social battery',
        level: level(mean(batterySource.map(c => c.energy))),
        receipt: withPeople.length ? `energy around people · ${count(withPeople.length)}` : `energy · ${count(three.length)}`
      }
    : { area: 'battery', label: 'social battery', level: null, receipt: 'one check-in fills this in' };

  const atWork = week.filter(c => c.tags.some(t => WORK.includes(t)));
  const focus: AreaReading = atWork.length
    ? {
        area: 'focus',
        label: 'focus',
        level: level(mean(atWork.map(c => (c.energy + c.pleasantness) / 2))),
        receipt: `work and study days · ${count(atWork.length)}`
      }
    : { area: 'focus', label: 'focus', level: null, receipt: 'tag work or study to see this' };

  return [mind, body, battery, focus];
}

/**
 * Low-day mode (report §7): when at least two of the last three days were
 * fog or storm, or the latest check-in in the last twelve hours was heavy,
 * Today collapses to one gentle screen.
 */
export function isLowDay(checkIns: readonly CheckIn[], now: Date = new Date()): boolean {
  const heavyDays = [0, 1, 2]
    .map(i => localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)))
    .map(date => weatherOf(checkIns.filter(c => c.localDate === date)))
    .filter(w => w === 'fog' || w === 'storm').length;
  if (heavyDays >= 2) return true;

  const latest = [...recent(checkIns, now, 0.5)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return Boolean(latest && latest.pleasantness <= -3);
}
