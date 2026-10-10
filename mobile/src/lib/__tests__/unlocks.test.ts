import { dayNumber, daysUntil, isUnlocked } from '../unlocks';

const at = (iso: string) => new Date(iso);

describe('dayNumber', () => {
  test('the day the account was made is day 1', () => {
    expect(dayNumber(at('2026-10-01T08:00:00'), at('2026-10-01T23:59:00'))).toBe(1);
  });

  test('counts calendar days, not 24-hour periods', () => {
    // Ten minutes apart, across midnight: two different days.
    expect(dayNumber(at('2026-10-01T23:55:00'), at('2026-10-02T00:05:00'))).toBe(2);
  });

  test('never goes below 1 if the clock is behind the account', () => {
    expect(dayNumber(at('2026-10-05T10:00:00'), at('2026-10-01T10:00:00'))).toBe(1);
  });
});

describe('isUnlocked', () => {
  const created = at('2026-10-01T09:00:00');

  test('Today and Check-in are open on day 1', () => {
    expect(isUnlocked('today', created, created)).toBe(true);
    expect(isUnlocked('checkIn', created, created)).toBe(true);
  });

  test('every feature is open from day 1', () => {
    for (const feature of ['mirror', 'patterns', 'mindChart', 'wrapped'] as const) {
      expect(isUnlocked(feature, created, created)).toBe(true);
      expect(daysUntil(feature, created, created)).toBe(0);
    }
  });

  test('the development override opens everything', () => {
    expect(isUnlocked('wrapped', created, created, true)).toBe(true);
  });
});
