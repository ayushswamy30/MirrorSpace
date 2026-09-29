import { momentAt, PATTERNS, roundSeconds, totalSeconds } from '../breathing';

const box = PATTERNS.find(p => p.key === 'box')!;
const sigh = PATTERNS.find(p => p.key === 'sigh')!;

test('every pattern is short enough to finish and breathes out longest or evenly', () => {
  for (const p of PATTERNS) {
    expect(totalSeconds(p)).toBeGreaterThan(30);
    expect(totalSeconds(p)).toBeLessThanOrEqual(180);
    const inhale = p.phases.filter(ph => ph.kind === 'in').reduce((s, ph) => s + ph.seconds, 0);
    const exhale = p.phases.filter(ph => ph.kind === 'out').reduce((s, ph) => s + ph.seconds, 0);
    expect(exhale).toBeGreaterThanOrEqual(inhale);
  }
});

test('box breathing walks in, hold, out, hold, counting down', () => {
  expect(momentAt(box, 0)).toMatchObject({ phase: { kind: 'in' }, round: 1, secondsLeft: 4 });
  expect(momentAt(box, 3500)).toMatchObject({ phase: { kind: 'in' }, secondsLeft: 1 });
  expect(momentAt(box, 4000)).toMatchObject({ phase: { kind: 'hold' }, phaseIndex: 1, secondsLeft: 4 });
  expect(momentAt(box, 9000)).toMatchObject({ phase: { kind: 'out' }, secondsLeft: 3 });
  expect(momentAt(box, 15999)).toMatchObject({ phase: { kind: 'hold' }, phaseIndex: 3, secondsLeft: 1 });
});

test('rounds follow on, and the pattern ends by itself', () => {
  expect(momentAt(box, roundSeconds(box) * 1000)).toMatchObject({ round: 2, phaseIndex: 0 });
  expect(momentAt(box, totalSeconds(box) * 1000 - 1)).toMatchObject({ done: false, round: box.rounds });
  expect(momentAt(box, totalSeconds(box) * 1000)).toEqual({ done: true });
});

test('the double sigh takes its second sip before the long sigh out', () => {
  expect(momentAt(sigh, 2100)).toMatchObject({ phase: { kind: 'in', cue: 'one more small breath in' } });
  expect(momentAt(sigh, 3100)).toMatchObject({ phase: { kind: 'out' }, secondsLeft: 6 });
});

test('a clock that runs backwards starts at the beginning', () => {
  expect(momentAt(box, -500)).toMatchObject({ round: 1, phaseIndex: 0 });
});
