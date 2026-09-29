import { EMOTIONS, findEmotion, QUADRANTS, wordsNearestFirst } from '../emotions';

test('the vocabulary is 100 distinct words, 25 per quadrant', () => {
  expect(EMOTIONS).toHaveLength(100);
  expect(new Set(EMOTIONS.map(e => e.word)).size).toBe(100);
  for (const q of QUADRANTS) {
    expect(EMOTIONS.filter(e => e.quadrant === q)).toHaveLength(25);
  }
});

test('every word sits on the grid, off-centre, on its quadrant’s side', () => {
  for (const e of EMOTIONS) {
    for (const value of [e.energy, e.pleasantness]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(Math.abs(value)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(value)).toBeLessThanOrEqual(5);
    }
    expect(e.energy > 0).toBe(e.quadrant.startsWith('charged'));
    expect(e.pleasantness > 0).toBe(e.quadrant.endsWith('-pleasant'));
  }
});

test('the corners are the extremes', () => {
  expect(findEmotion('enraged')).toMatchObject({ energy: 5, pleasantness: -5 });
  expect(findEmotion('ecstatic')).toMatchObject({ energy: 5, pleasantness: 5 });
  expect(findEmotion('despairing')).toMatchObject({ energy: -5, pleasantness: -5 });
  expect(findEmotion('blissful')).toMatchObject({ energy: -5, pleasantness: 5 });
});

test('each quadrant lists its everyday words before its extremes', () => {
  for (const q of QUADRANTS) {
    const words = wordsNearestFirst(q);
    expect(words).toHaveLength(25);
    const reach = words.map(e => Math.abs(e.energy) + Math.abs(e.pleasantness));
    expect(reach).toEqual([...reach].sort((a, b) => a - b));
  }
});
