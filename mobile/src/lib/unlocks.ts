/**
 * Progressive unlocks (report §7): the app starts with two things and grows.
 *
 *   day 1   Today, Check-in
 *   day 3   Mirror chat
 *   day 7   Patterns (the Chart tab)
 *   day 14  Mind Chart           — v1
 *   day 30  Wrapped              — v1
 *
 * "Day 1" is the day the account was created, counted in calendar days in the
 * user's own timezone — opening the app at 23:50 and again at 00:10 is two days.
 */

export type Feature = 'today' | 'checkIn' | 'mirror' | 'patterns' | 'mindChart' | 'wrapped';

export const unlockDay: Record<Feature, number> = {
  today: 1,
  checkIn: 1,
  mirror: 3,
  patterns: 7,
  mindChart: 14,
  wrapped: 30
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 1 on the day the account was created, 2 the next calendar day, and so on. */
export function dayNumber(createdAt: Date, now: Date = new Date()): number {
  // Math.round absorbs the 23- and 25-hour days at DST changes.
  const elapsed = Math.round((localMidnight(now) - localMidnight(createdAt)) / MS_PER_DAY);
  return Math.max(1, elapsed + 1);
}

export function isUnlocked(feature: Feature, createdAt: Date, now: Date = new Date(), unlockAll = false): boolean {
  return unlockAll || dayNumber(createdAt, now) >= unlockDay[feature];
}

/** Days left until a feature opens; 0 once it is open. */
export function daysUntil(feature: Feature, createdAt: Date, now: Date = new Date()): number {
  return Math.max(0, unlockDay[feature] - dayNumber(createdAt, now));
}
