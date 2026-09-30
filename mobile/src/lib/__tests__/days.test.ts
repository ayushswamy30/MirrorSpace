import { addDays, dayRecord, weekOf } from '../days';
import { localDate, type CheckIn } from '../checkIns';
import { night } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../session', () => ({ useProfile: jest.fn() }));

// A Wednesday.
const NOW = new Date(2026, 8, 30, 20, 0);

function on(daysAgo: number, pleasantness: number, emotion = 'calm'): CheckIn {
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 12, 0);
  return { id: `${daysAgo}-${emotion}`, createdAt: at.toISOString(), localDate: localDate(at), emotion, energy: -1, pleasantness, tags: [], note: null };
}

test('a week starts on the chosen day', () => {
  expect(weekOf(NOW, 'monday').map(d => d.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
  expect(weekOf(NOW, 'sunday').map(d => d.getDay())).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(weekOf(NOW, 'monday').map(localDate)).toContain(localDate(NOW));
});

test('a past day holds its own check-ins, its night and its pages', () => {
  const twoAgo = addDays(NOW, -2);
  const data = {
    checkIns: [on(2, 3, 'glad'), on(0, -3, 'drained')],
    sleep: [night(23 * 60, 7 * 60, twoAgo)],
    pages: [{ id: 'v', createdAt: twoAgo.toISOString(), localDate: localDate(twoAgo), body: 'a page' }]
  };
  const day = dayRecord(twoAgo, data, true);
  expect(day.checkIns.map(c => c.emotion)).toEqual(['glad']);
  expect(day.weather).toBe('clear');
  expect(day.night?.minutes).toBe(8 * 60);
  expect(day.pages).toHaveLength(1);
});

test("an old reading doesn't change with what came after", () => {
  const twoAgo = addDays(NOW, -2);
  const before = dayRecord(twoAgo, { checkIns: [on(2, 4)], sleep: [], pages: [] }, true);
  const after = dayRecord(twoAgo, { checkIns: [on(2, 4), on(1, -5), on(0, -5)], sleep: [], pages: [] }, true);
  expect(after.view.reading.headline).toBe(before.view.reading.headline);
  expect(after.view.weather).toBe(before.view.weather);
});
