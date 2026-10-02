import { isWeekEnd, weekReflection } from '../week';
import { localDate, type CheckIn } from '../checkIns';
import { night } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

// A Friday.
const NOW = new Date(2026, 9, 2, 20, 0);

function on(daysAgo: number, pleasantness: number, emotion = 'calm', tags: string[] = []): CheckIn {
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 12, 0);
  return { id: `${daysAgo}-${emotion}`, createdAt: at.toISOString(), localDate: localDate(at), emotion, energy: -1, pleasantness, tags, note: null };
}

test('a quiet week is named kindly, never as a broken chain', () => {
  const week = weekReflection([], [], NOW);
  expect(week.quiet).toBe(7);
  expect(week.summary).toBe('A quiet week — nothing was written down, and that’s allowed.');
});

test('the week reads its lightest and heaviest days, words and nights', () => {
  const twoAgo = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 2);
  const week = weekReflection(
    [on(0, 4, 'glad'), on(2, -4, 'drained', ['work']), on(3, 1, 'calm'), on(9, -5, 'old')],
    [night(23 * 60, 7 * 60, twoAgo)],
    NOW
  );
  expect(week.checkedIn).toBe(3);
  expect(week.quiet).toBe(4);
  expect(week.lightest?.weekday).toBe(NOW.toLocaleDateString([], { weekday: 'long' }));
  expect(week.heaviest?.weekday).toBe(twoAgo.toLocaleDateString([], { weekday: 'long' }));
  expect(week.words.map(w => w.word)).not.toContain('old');
  expect(week.nights).toMatchObject({ count: 1, average: 480 });
  expect(week.summary).toMatch(/the heaviest, .* the lightest\. Nights averaged 8h\.$/);
});

test('the reflection is offered on the last day of the chosen week', () => {
  const sunday = new Date(2026, 9, 4);
  const saturday = new Date(2026, 9, 3);
  expect(isWeekEnd(sunday, 'monday')).toBe(true);
  expect(isWeekEnd(saturday, 'sunday')).toBe(true);
  expect(isWeekEnd(saturday, 'monday')).toBe(false);
});
