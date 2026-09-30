import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CircleValidationError,
  currentWeather,
  generateCode,
  isLow,
  normalizeCode,
  parseName,
  parseStatus,
  rhythmLine
} from '../../lib/circle.js';

test('codes are six characters with nothing to misread', () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test('a typed code forgives case, spaces and dashes', () => {
  assert.equal(normalizeCode(' k7m-2qx '), 'K7M2QX');
  assert.throws(() => normalizeCode('K7M2Q0'), CircleValidationError);
  assert.throws(() => normalizeCode('short'), CircleValidationError);
});

test('names are trimmed and kept short', () => {
  assert.equal(parseName('  Sam   R  '), 'Sam R');
  assert.throws(() => parseName('   '), CircleValidationError);
  assert.throws(() => parseName('x'.repeat(25)), CircleValidationError);
});

test('status is a weather word, its date and seven numbers — nothing more', () => {
  assert.deepEqual(parseStatus({ weather: 'fog', date: '2026-09-30', rhythm: [1, -2.345, null, 0, 3, 4, -5] }), {
    weather: 'fog',
    weatherDate: '2026-09-30',
    rhythm: [1, -2.3, null, 0, 3, 4, -5]
  });
  assert.throws(() => parseStatus({ weather: 'fog', date: '2026-09-30', note: 'hi' }), /unexpected fields: note/);
  assert.throws(() => parseStatus({ weather: 'sad', date: '2026-09-30' }), CircleValidationError);
  assert.throws(() => parseStatus({ weather: 'fog' }), /needs its date/);
  assert.throws(() => parseStatus({ rhythm: [1, 2, 3] }), CircleValidationError);
  assert.throws(() => parseStatus({ rhythm: [9, 0, 0, 0, 0, 0, 0] }), CircleValidationError);
});

test('running low clears itself after a day', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  assert.equal(isLow('2026-09-30T02:00:00Z', now), true);
  assert.equal(isLow('2026-09-29T11:00:00Z', now), false);
  assert.equal(isLow(null, now), false);
});

test("only today's weather is shown", () => {
  const now = new Date('2026-09-30T08:00:00Z');
  assert.equal(currentWeather('clear', '2026-09-30', now), 'clear');
  assert.equal(currentWeather('clear', '2026-09-27', now), null);
});

test('rhythm lines say what the two weeks share, or nothing', () => {
  const sam = [1, 1, 1, -3, 1, 2, 3];
  const you = [0, 0, 1, -2, 0, 1, 4];
  assert.equal(rhythmLine(you, sam, 'Sam'), 'You both run heavy on Thursdays.');
  assert.equal(rhythmLine([2, 0, -1, 1, 1, 1, 4], [1, -2, 0, 0, 0, 0, 3], 'Sam'), 'Sundays tend to be good for you both.');
  assert.match(rhythmLine([-3, 0, 1, 1, 1, 2, 0], [1, 1, 1, 1, -3, 0, 2], 'Sam'), /Mondays for you, Fridays for Sam/);
  assert.equal(rhythmLine([1, null, null, null, null, 0, 0], sam, 'Sam'), null);
});
