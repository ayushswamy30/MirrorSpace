import { ALL_SOUNDS, FADE_MS, fadeVolume, SOUND_CATEGORIES } from '../sounds';

// Each asset is a require() of its file, so a missing file fails this suite
// at import time.
test('28 sounds in nine categories, each with a unique key and a bundled file', () => {
  expect(SOUND_CATEGORIES.map(c => c.key)).toEqual([
    'rain',
    'water',
    'nature',
    'cozy',
    'noise',
    'ambient',
    'sleep',
    'meditation',
    'unique'
  ]);
  expect(ALL_SOUNDS).toHaveLength(28);
  expect(new Set(ALL_SOUNDS.map(s => s.key)).size).toBe(28);

  for (const sound of ALL_SOUNDS) expect(sound.asset).toBeDefined();
});

test('the sleep-timer fade starts at full volume, eases out and ends silent', () => {
  expect(fadeVolume(0)).toBe(1);
  expect(fadeVolume(FADE_MS / 2)).toBeCloseTo(0.5);
  expect(fadeVolume(FADE_MS)).toBeCloseTo(0);
  expect(fadeVolume(FADE_MS * 2)).toBeCloseTo(0);
  expect(fadeVolume(FADE_MS * 0.25)).toBeGreaterThan(fadeVolume(FADE_MS * 0.75));
});
