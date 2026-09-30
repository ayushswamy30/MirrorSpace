import { useCallback, useEffect, useState } from 'react';

import { allCheckIns, localDate, onCheckInsChanged, type CheckIn } from './checkIns';
import { today, weatherOf, type Today } from './patterns';
import type { WeekStart } from './preferences';
import { useProfile } from './session';
import { allSleep, onSleepChanged, type SleepLog } from './sleep';
import { listVents, type Vent } from './vents';
import type { Weather } from '@/theme/tokens';

/**
 * Any past day, as Today would have shown it that evening — the reference's
 * "TODAY ⌄" that lets you step back through the week. Built only from what
 * existed by the end of that day, so an old reading never quietly changes
 * with what came after.
 */

export type DayRecord = {
  date: string;
  /** The reading as it stood at the end of that day. */
  view: Today;
  /** That day's own weather, from its check-ins alone. */
  weather: Weather | null;
  checkIns: CheckIn[];
  /** The night that ended that morning. */
  night: SleepLog | null;
  /** Vent pages kept that day. */
  pages: Vent[];
};

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The seven days of the week holding `anchor`, from the chosen first day. */
export function weekOf(anchor: Date, weekStart: WeekStart): Date[] {
  const day = startOfDay(anchor);
  const offset = weekStart === 'monday' ? (day.getDay() + 6) % 7 : day.getDay();
  const first = addDays(day, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function dayRecord(
  date: Date,
  data: { checkIns: readonly CheckIn[]; sleep: readonly SleepLog[]; pages: readonly Vent[] },
  personal: boolean
): DayRecord {
  const key = localDate(date);
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  const sofar = data.checkIns.filter(c => c.localDate <= key);
  const own = data.checkIns
    .filter(c => c.localDate === key)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    date: key,
    view: today(sofar, { personal, todayDate: key, now: endOfDay, sleep: data.sleep.filter(l => l.wakeDate <= key) }),
    weather: weatherOf(own),
    checkIns: own,
    night: data.sleep.find(l => l.wakeDate === key) ?? null,
    pages: data.pages.filter(p => p.localDate === key)
  };
}

/** Which days of a week have any check-in, and their weather — for the strip's marks. */
export function weekMarks(days: readonly Date[], checkIns: readonly CheckIn[]): (Weather | null)[] {
  return days.map(d => weatherOf(checkIns.filter(c => c.localDate === localDate(d))));
}

type Data = { checkIns: CheckIn[]; sleep: SleepLog[]; pages: Vent[] };

/** Everything the day pages read, kept fresh as check-ins and nights change. */
export function useDays(): Data | null {
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(() => {
    Promise.all([allCheckIns(), allSleep(), listVents(500)])
      .then(([checkIns, sleep, pages]) => setData({ checkIns, sleep, pages }))
      .catch(err => console.warn('Days unavailable:', err));
  }, []);

  useEffect(() => {
    load();
    const off = [onCheckInsChanged(load), onSleepChanged(load)];
    return () => off.forEach(f => f());
  }, [load]);

  return data;
}

export function useDayRecord(date: Date, data: Data | null): DayRecord | null {
  const personal = useProfile().consents.readings?.granted === true;
  return data ? dayRecord(date, data, personal) : null;
}
