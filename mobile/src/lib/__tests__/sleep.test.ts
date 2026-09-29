import type { CheckIn } from '../checkIns';
import { sleepFacts, today } from '../patterns';
import { formatClock, formatDuration, night, step } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

const MORNING = new Date(2026, 8, 29, 9, 0); // 29 Sep, local

test('a bedtime before midnight belongs to the evening before', () => {
  const n = night(23 * 60 + 30, 7 * 60, MORNING);
  expect(n.minutes).toBe(7 * 60 + 30);
  expect(n.wakeDate).toBe('2026-09-29');
  expect(new Date(n.bedAt).getDate()).toBe(28);
});

test('a bedtime after midnight belongs to the wake day', () => {
  const n = night(1 * 60 + 15, 6 * 60, MORNING);
  expect(n.minutes).toBe(4 * 60 + 45);
  expect(new Date(n.bedAt).getDate()).toBe(29);
});

test('times step by fifteen minutes and wrap round midnight', () => {
  expect(step(23 * 60 + 45, 1)).toBe(0);
  expect(step(0, -1)).toBe(23 * 60 + 45);
  expect(formatClock(7 * 60 + 5)).toBe('07:05');
  expect(formatDuration(420)).toBe('7h');
  expect(formatDuration(405)).toBe('6h 45m');
});

// ---------------------------------------------------------------------------

const NOW = new Date(2026, 8, 29, 20, 0);

function day(daysAgo: number) {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 8, 0);
}

function checkInOn(daysAgo: number, pleasantness: number): CheckIn {
  const at = day(daysAgo);
  const d = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return { id: `c${daysAgo}`, createdAt: at.toISOString(), localDate: d, emotion: 'x', energy: -1, pleasantness, tags: [], note: null };
}

function sleptBefore(daysAgo: number, minutes: number) {
  const wake = 7 * 60;
  return night((wake - minutes + 1440) % 1440, wake, day(daysAgo));
}

test('a week of nights gives an average, from three nights up', () => {
  expect(sleepFacts([sleptBefore(0, 420), sleptBefore(1, 420)], [], NOW)).toEqual([]);
  const f = sleepFacts([sleptBefore(0, 420), sleptBefore(1, 390), sleptBefore(2, 450)], [], NOW);
  expect(f[0]).toMatchObject({ key: 'sleep-average', text: 'You slept 7h a night on average this week.' });
});

test('heavier days after short nights are noticed — with the numbers, and no cause claimed', () => {
  const sleep = [sleptBefore(1, 300), sleptBefore(2, 330), sleptBefore(3, 480), sleptBefore(4, 450)];
  const checkIns = [checkInOn(1, -3), checkInOn(2, -2), checkInOn(3, 3), checkInOn(4, 2)];
  const fact = sleepFacts(sleep, checkIns, NOW).find(x => x.key === 'short-sleep');
  expect(fact?.text).toBe('After nights under 6 hours, your check-ins tended to be heavier.');
  expect(fact?.receipt).toMatch(/^2 check-ins after short nights · -5.0 vs others/);
});

test('one short night is not a pattern', () => {
  const sleep = [sleptBefore(1, 300), sleptBefore(3, 480), sleptBefore(4, 450)];
  const checkIns = [checkInOn(1, -4), checkInOn(3, 3), checkInOn(4, 2)];
  expect(sleepFacts(sleep, checkIns, NOW).find(x => x.key === 'short-sleep')).toBeUndefined();
});

test('last night shows even with readings off; sleep facts only with them on', () => {
  const sleep = [sleptBefore(0, 420), sleptBefore(1, 420), sleptBefore(2, 420)];
  const todayDate = sleep[0].wakeDate;
  const off = today([], { personal: false, todayDate, now: NOW, sleep });
  expect(off.lastNight?.minutes).toBe(420);
  expect(off.facts).toEqual([]);

  const on = today([], { personal: true, todayDate, now: NOW, sleep });
  expect(on.facts.map(f => f.key)).toContain('sleep-average');
});
