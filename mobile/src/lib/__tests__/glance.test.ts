import { glance, isLowDay } from '../glance';
import { localDate, type CheckIn } from '../checkIns';
import { night } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

const NOW = new Date(2026, 9, 2, 20, 0);

function at(hoursAgo: number, energy: number, pleasantness: number, tags: string[] = []): CheckIn {
  const d = new Date(NOW.getTime() - hoursAgo * 3600 * 1000);
  return { id: `${hoursAgo}`, createdAt: d.toISOString(), localDate: localDate(d), emotion: 'x', energy, pleasantness, tags, note: null };
}

test('each area says where it came from, or that it has nothing yet', () => {
  const [mind, body, battery, focus] = glance([], [], NOW);
  expect([mind.level, body.level, battery.level, focus.level]).toEqual([null, null, null, null]);
  expect(focus.receipt).toBe('tag work or study to see this');
});

test('mind follows how check-ins felt; body follows last night', () => {
  const lastNight = night(23 * 60, 6 * 60 + 30, NOW);
  const [mind, body] = glance([at(2, 1, 4), at(26, 2, 5)], [lastNight], NOW);
  expect(mind.level).toBe(5);
  expect(mind.receipt).toBe('how 2 check-ins felt · 3 days');
  expect(body.level).toBe(4);
  expect(body.receipt).toBe('7h 30m last night');
});

test('social battery prefers energy around people; focus reads work and study days', () => {
  const [, , battery, focus] = glance([at(3, -4, 1, ['friends']), at(5, 4, 3, ['work']), at(30, 4, 2)], [], NOW);
  expect(battery.level).toBe(1);
  expect(battery.receipt).toBe('energy around people · 1 check-in');
  expect(focus.level).toBe(4);
});

test('two heavy days out of three, or a heavy check-in just now, is a low day', () => {
  expect(isLowDay([at(1, -3, -4), at(25, -3, -4)], NOW)).toBe(true);
  expect(isLowDay([at(1, -2, -4)], NOW)).toBe(true);
  expect(isLowDay([at(1, 2, 3), at(25, -3, -4)], NOW)).toBe(false);
  expect(isLowDay([], NOW)).toBe(false);
});
