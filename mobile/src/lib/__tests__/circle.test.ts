import { weekdayRhythm } from '../circle';
import { localDate, type CheckIn } from '../checkIns';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../api', () => ({ api: {} }));

// A Wednesday.
const NOW = new Date(2026, 8, 30, 20, 0);

function on(daysAgo: number, pleasantness: number): CheckIn {
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 12, 0);
  return { id: `${daysAgo}-${pleasantness}`, createdAt: at.toISOString(), localDate: localDate(at), emotion: 'x', energy: 1, pleasantness, tags: [], note: null };
}

test('seven numbers, Monday first: each weekday’s average pleasantness', () => {
  // Wednesdays: today and a week ago. Mondays: two and nine days ago.
  const rhythm = weekdayRhythm([on(0, 3), on(7, 1), on(2, -4), on(9, -2)], NOW);
  expect(rhythm).toHaveLength(7);
  expect(rhythm[2]).toBe(2);
  expect(rhythm[0]).toBe(-3);
});

test('a weekday seen once says nothing, and old weeks are left out', () => {
  const rhythm = weekdayRhythm([on(1, 4), on(35, 4), on(42, 4)], NOW);
  expect(rhythm.every(v => v === null)).toBe(true);
});
