import { localDate, type CheckIn } from '../checkIns';
import { night } from '../sleep';
import { spanOf, storyOf, wrapped } from '../wrapped';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

// Thursday 8 October 2026.
const NOW = new Date(2026, 9, 8, 21, 0);

function on(date: string, pleasantness: number, emotion = 'calm', tags: string[] = []): CheckIn {
  const at = new Date(`${date}T10:00:00`);
  return { id: `${date}-${emotion}-${pleasantness}`, createdAt: at.toISOString(), localDate: localDate(at), emotion, energy: -1, pleasantness, tags, note: null };
}

test('spans: this month so far, the whole of last month, the year so far', () => {
  expect(spanOf('this-month', NOW)).toMatchObject({ from: '2026-10-01', to: '2026-10-08' });
  expect(spanOf('last-month', NOW)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
  expect(spanOf('this-year', NOW)).toMatchObject({ from: '2026-01-01', to: '2026-10-08', label: '2026' });
});

test('a month wrapped: days, weather, the word, what restored and drained, nights and pages', () => {
  const checkIns = [
    on('2026-10-01', 4, 'glad', ['outside']),
    on('2026-10-02', 3, 'glad', ['outside']),
    on('2026-10-03', 4, 'calm', ['outside']),
    on('2026-10-05', -4, 'drained', ['work']),
    on('2026-10-06', -3, 'tired', ['work']),
    on('2026-10-07', -4, 'drained', ['work']),
    on('2026-09-20', 5, 'old')
  ];
  const sleep = [night(23 * 60, 7 * 60, new Date(2026, 9, 2)), night(0, 6 * 60, new Date(2026, 9, 3))];
  const w = wrapped(checkIns, sleep, ['2026-10-04', '2026-09-01'], spanOf('this-month', NOW));

  expect(w).toMatchObject({ days: 8, checkedIn: 6, checkIns: 6, mostly: { weather: 'clear', days: 3 }, pages: 1 });
  expect(w.word).toEqual({ word: 'drained', count: 2 });
  expect(w.restorer?.tag).toBe('outside');
  expect(w.drain?.tag).toBe('work');
  expect(w.nights).toMatchObject({ count: 2, average: 420 });

  const story = storyOf(w);
  expect(story.map(s => s.key)).toEqual(['days', 'weather', 'word', 'restorer', 'drain', 'nights', 'pages']);
  expect(story[0]).toMatchObject({ title: '6 days with a word in them.', line: 'And 2 quiet ones — those count too.' });
  expect(story[2].title).toBe('“drained”');
});

test('a quiet stretch is said kindly, and nothing else is made up', () => {
  const story = storyOf(wrapped([], [], [], spanOf('last-month', NOW)));
  expect(story).toEqual([expect.objectContaining({ title: 'A quiet stretch.' })]);
});

test('a year names its best-rested and lightest months', () => {
  const days = (month: string, pleasantness: number) =>
    [1, 2, 3, 4, 5].map(d => on(`2026-${month}-0${d}`, pleasantness));
  const nights = (month: number, wake: number) =>
    [1, 2, 3, 4, 5].map(d => night(23 * 60, wake, new Date(2026, month - 1, d)));
  const w = wrapped([...days('03', 4), ...days('04', -2)], [...nights(3, 6 * 60), ...nights(4, 8 * 60)], [], spanOf('this-year', NOW));
  expect(w.lightestMonth).toBe(new Date(2026, 2, 15).toLocaleDateString([], { month: 'long' }));
  expect(w.bestRested).toEqual({ month: new Date(2026, 3, 15).toLocaleDateString([], { month: 'long' }), average: 540 });
});
