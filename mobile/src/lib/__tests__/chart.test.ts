import { dailyWeather, mostlyWeather, nightly, nightsSummary, tagTable, topWords, WEATHER_INK } from '../chart';
import { localDate, type CheckIn } from '../checkIns';
import { night } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

const NOW = new Date(2026, 8, 29, 20, 0);

function on(daysAgo: number, pleasantness: number, energy = -1, tags: string[] = [], emotion = 'tired'): CheckIn {
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 12, 0);
  return { id: `${daysAgo}-${emotion}-${pleasantness}`, createdAt: at.toISOString(), localDate: localDate(at), emotion, energy, pleasantness, tags, note: null };
}

test('thirty calendar days, oldest first, ending today, each with its own weather', () => {
  const days = dailyWeather([on(0, 3), on(0, 4), on(2, -3, -3), on(40, 3)], NOW);
  expect(days).toHaveLength(30);
  expect(days[29]).toMatchObject({ date: localDate(NOW), weather: 'clear', checkIns: 2 });
  expect(days[27]).toMatchObject({ weather: 'fog', checkIns: 1 });
  expect(days[28]).toMatchObject({ weather: null, checkIns: 0 });
});

test('the words reached for most, ties in alphabetical order', () => {
  const words = topWords([on(1, 1, 1, [], 'calm'), on(2, 1, 1, [], 'calm'), on(3, 1, 1, [], 'tired'), on(3, 1, 1, [], 'bored')], NOW);
  expect(words).toEqual([
    { word: 'calm', count: 2 },
    { word: 'bored', count: 1 },
    { word: 'tired', count: 1 }
  ]);
});

test('tags lean lighter or heavier only on a clear gap, and from two uses', () => {
  const rows = tagTable(
    [on(1, -3, -1, ['work']), on(2, -2, -1, ['work']), on(3, 3, 1, ['friends']), on(4, 4), on(5, 3)],
    NOW
  );
  expect(rows).toEqual([
    { tag: 'work', count: 2, lean: 'heavier' },
    { tag: 'friends', count: 1, lean: 'even' }
  ]);
});

test('nights: average, count and short nights over thirty days', () => {
  const logs = [
    night(23 * 60, 7 * 60, new Date(2026, 8, 28)),
    night(1 * 60, 6 * 60, new Date(2026, 8, 29)),
    night(23 * 60, 7 * 60, new Date(2026, 7, 1))
  ];
  expect(nightsSummary(logs, NOW)).toEqual({ nights: 2, averageMinutes: 390, shortNights: 1 });
  expect(nightsSummary([], NOW)).toBeNull();
});

test('weather ink runs from light to heavy', () => {
  const order = ['clear', 'mild', 'overcast', 'fog', 'storm'] as const;
  const inks = order.map(w => WEATHER_INK[w]);
  expect(inks).toEqual([...inks].sort((a, b) => a - b));
});

test('nights line up by the morning they ended, with gaps left empty', () => {
  const lastNight = night(23 * 60, 7 * 60, NOW);
  const threeAgo = night(1 * 60, 6 * 60, new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 3));
  const nights = nightly([lastNight, threeAgo], NOW);
  expect(nights).toHaveLength(30);
  expect(nights[29]).toBe(8 * 60);
  expect(nights[26]).toBe(5 * 60);
  expect(nights[28]).toBeNull();
});

test('the month is named for its most common weather, ties to the lighter sky', () => {
  expect(mostlyWeather(dailyWeather([], NOW))).toBeNull();
  const days = dailyWeather([on(0, 3), on(1, -3, -3), on(2, 3), on(3, -3, -3)], NOW);
  expect(mostlyWeather(days)).toEqual({ weather: 'clear', days: 2 });
});
