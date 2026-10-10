/**
 * Progressive unlocks (report §7). Since 2026-10-10 everything opens on day 1:
 * every feature is for everyone from the start. The days are kept so a
 * feature can be held back again by raising its number here. Screens with
 * little data say so themselves ("still filling in").
 *
 * "Day 1" is the day the account was created, counted in calendar days in the
 * user's own timezone — opening the app at 23:50 and again at 00:10 is two days.
 */

export type Feature = 'today' | 'checkIn' | 'mirror' | 'patterns' | 'mindChart' | 'wrapped';

export const unlockDay: Record<Feature, number> = {
  today: 1,
  checkIn: 1,
  mirror: 1,
  patterns: 1,
  mindChart: 1,
  wrapped: 1
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
