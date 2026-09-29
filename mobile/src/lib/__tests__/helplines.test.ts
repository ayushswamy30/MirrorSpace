import { emergencyNumberFor, FALLBACK_EMERGENCY, helplines, helplinesFor } from '../helplines';

describe('helplinesFor', () => {
  test('puts the user’s own region first and keeps every other line', () => {
    const lines = helplinesFor('IN');
    expect(lines[0].name).toBe('Tele-MANAS');
    expect(lines).toHaveLength(helplines.length);
  });

  test('an unknown region still shows every line', () => {
    expect(helplinesFor(null)).toHaveLength(helplines.length);
    expect(helplinesFor('FR')).toHaveLength(helplines.length);
  });

  test('every line can actually be reached', () => {
    for (const line of helplines) {
      expect(line.call ?? line.text).toMatch(/^\d+$/);
    }
  });
});

describe('emergencyNumberFor', () => {
  test('uses the regional number where known', () => {
    expect(emergencyNumberFor('US')).toBe('911');
    expect(emergencyNumberFor('GB')).toBe('999');
  });

  test('falls back to 112 elsewhere', () => {
    expect(emergencyNumberFor('FR')).toBe(FALLBACK_EMERGENCY);
    expect(emergencyNumberFor(null)).toBe(FALLBACK_EMERGENCY);
  });
});
