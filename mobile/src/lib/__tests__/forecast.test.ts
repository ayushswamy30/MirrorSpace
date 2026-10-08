import { localDate, type CheckIn } from '../checkIns';
import { forecast, nightsSignal, trendSignal, weekdaySignal } from '../forecast';
import { night } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

// Thursday 8 October 2026, evening; tomorrow is a Friday.
const NOW = new Date(2026, 9, 8, 21, 0);

function on(daysAgo: number, pleasantness: number): CheckIn {
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 12, 0);
  return { id: `${daysAgo}-${pleasantness}-${Math.random()}`, createdAt: at.toISOString(), localDate: localDate(at), emotion: 'calm', energy: -1, pleasantness, tags: [], note: null };
}

function nightAgo(daysAgo: number, bed: number, wake: number) {
  return night(bed, wake, new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo));
}

describe('trend', () => {
  test('needs three recent check-ins and a baseline of five', () => {
    expect(trendSignal([on(0, -4), on(1, -4), on(5, 3)], NOW)).toBeNull();
  });

  test('reads the last three days against the two weeks before', () => {
    const list = [on(0, -3), on(1, -4), on(2, -3), ...[4, 5, 6, 7, 8].map(d => on(d, 2))];
    expect(trendSignal(list, NOW)).toMatchObject({ lean: 'heavier', receipt: 'last 3 days −5.3 vs the 2 weeks before · 3 + 5 check-ins' });
  });
});

describe('nights', () => {
  const usual = [3, 4, 5, 6, 7, 8, 9, 10].map(d => nightAgo(d, 23 * 60, 7 * 60));

  test('later than usual leans heavier, with both times as the receipt', () => {
    const late = [0, 1, 2].map(d => nightAgo(d, 1 * 60 + 30, 9 * 60));
    expect(nightsSignal([...usual, ...late], NOW)).toMatchObject({
      lean: 'heavier',
      receipt: 'asleep ~01:30 lately · usually ~23:00 · 11 nights'
    });
  });

  test('two short nights of the last three lean heavier', () => {
    const short = [nightAgo(0, 23 * 60, 4 * 60), nightAgo(1, 23 * 60, 4 * 60 + 30), nightAgo(2, 23 * 60, 7 * 60)];
    expect(nightsSignal([...usual, ...short], NOW)?.text).toBe('2 of your last 3 nights were under 6 hours.');
  });

  test('usual nights say nothing', () => {
    expect(nightsSignal([...usual, nightAgo(0, 23 * 60, 7 * 60), nightAgo(1, 23 * 60, 7 * 60)], NOW)).toBeNull();
  });
});

test('a weekday that has run heavier, with three of them to go on', () => {
  // 6, 13 and 20 days back are Fridays.
  const fridays = [6, 13, 20].map(d => on(d, -4));
  const rest = [1, 2, 3, 4, 5, 7, 8, 9].map(d => on(d, 2));
  expect(weekdaySignal([...fridays, ...rest], NOW)).toMatchObject({ lean: 'heavier', text: 'Fridays have tended to run heavier for you.' });
});

test('no signals, no forecast; one says "may"; two say it plainly', () => {
  expect(forecast([], [], NOW)).toBeNull();

  const heavyRecent = [on(0, -3), on(1, -4), on(2, -3), ...[4, 5, 6, 7, 8].map(d => on(d, 2))];
  expect(forecast(heavyRecent, [], NOW)).toMatchObject({ outlook: 'heavier', title: 'Tomorrow may run heavier.' });

  const usual = [3, 4, 5, 6, 7, 8, 9, 10].map(d => nightAgo(d, 23 * 60, 7 * 60));
  const late = [0, 1, 2].map(d => nightAgo(d, 1 * 60 + 30, 9 * 60));
  expect(forecast(heavyRecent, [...usual, ...late], NOW)).toMatchObject({ outlook: 'heavier', title: 'Tomorrow looks heavy.' });
});
