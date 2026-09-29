import type { CheckIn } from '../checkIns';
import { buildReading, facts, GENERAL_READING, innerWeather, today } from '../patterns';

const NOW = new Date('2026-09-29T20:00:00Z');
const HOUR = 60 * 60 * 1000;

let n = 0;
function ci(hoursAgo: number, energy: number, pleasantness: number, tags: string[] = [], emotion = 'x'): CheckIn {
  const at = new Date(NOW.getTime() - hoursAgo * HOUR);
  return {
    id: `c${n++}`,
    createdAt: at.toISOString(),
    localDate: at.toISOString().slice(0, 10),
    emotion,
    energy,
    pleasantness,
    tags,
    note: null
  };
}

describe('inner weather', () => {
  test('nothing in the last three days means no weather yet', () => {
    expect(innerWeather([], NOW)).toBeNull();
    expect(innerWeather([ci(80, 3, 3)], NOW)).toBeNull();
  });

  test('pleasantness sets the brightness', () => {
    expect(innerWeather([ci(1, 2, 4), ci(20, -2, 3)], NOW)).toBe('clear');
    expect(innerWeather([ci(1, 2, 1)], NOW)).toBe('mild');
    expect(innerWeather([ci(1, -2, -1), ci(5, 3, 1)], NOW)).toBe('overcast');
  });

  test('energy tells a storm from fog', () => {
    expect(innerWeather([ci(1, 4, -4), ci(10, 3, -3)], NOW)).toBe('storm');
    expect(innerWeather([ci(1, -4, -4), ci(10, -3, -2)], NOW)).toBe('fog');
  });
});

describe('facts', () => {
  test('a count of days, never a streak', () => {
    const f = facts([ci(1, 1, 1), ci(3, 1, 1), ci(30, 1, 1)], NOW);
    expect(f.find(x => x.key === 'days')?.text).toBe('You checked in on 2 of the last 7 days.');
  });

  test('shares need at least three check-ins behind them', () => {
    expect(facts([ci(1, -3, -3), ci(2, -3, -3)], NOW).map(f => f.key)).toEqual(['days']);
  });

  test('a mostly low, heavy week says so, with its numbers', () => {
    const week = [ci(1, -3, -3), ci(25, -2, -2), ci(50, -4, -1), ci(75, 2, 2), ci(100, -1, -2)];
    const f = facts(week, NOW);
    const low = f.find(x => x.key === 'low-energy');
    expect(low?.text).toBe('4 of your last 5 check-ins were low on energy.');
    expect(low?.receipt).toBe('4/5 low energy · 7 days');
    expect(f.find(x => x.key === 'unpleasant')).toBeDefined();
  });

  test('a tag whose check-ins sit apart is noticed, without claiming a cause', () => {
    const week = [
      ci(1, 1, -3, ['work']),
      ci(25, 1, -2, ['work']),
      ci(50, 1, 3, ['friends']),
      ci(75, 1, 4, []),
      ci(100, 1, 3, [])
    ];
    const tag = facts(week, NOW).find(x => x.key === 'tag-work');
    expect(tag?.text).toBe('Check-ins tagged “work” tended to be heavier than the rest.');
    expect(tag?.text).not.toMatch(/because|caused/);
  });

  test('a tag used once is not a pattern', () => {
    const week = [ci(1, 1, -4, ['work']), ci(25, 1, 3), ci(50, 1, 3)];
    expect(facts(week, NOW).find(x => x.key.startsWith('tag-'))).toBeUndefined();
  });

  test('older than a week is not counted', () => {
    expect(facts([ci(24 * 8, -3, -3)], NOW)).toEqual([]);
  });
});

describe('the reading', () => {
  test('no weather reads as the general reading', () => {
    expect(buildReading(null, undefined)).toBe(GENERAL_READING);
  });

  test('the strongest fact becomes the subtext; the day count never does', () => {
    const fact = { key: 'unpleasant', text: 'A heavier week.', receipt: '', weight: 1 };
    expect(buildReading('fog', fact).subtext).toBe('A heavier week.');
    const days = { key: 'days', text: 'You checked in on 2 of the last 7 days.', receipt: '', weight: 0 };
    expect(buildReading('fog', days).subtext).not.toBe(days.text);
  });

  test('with readings consent off: general reading, no weather, no facts', () => {
    const t = today([ci(1, -4, -4), ci(2, -4, -4), ci(3, -4, -4)], { personal: false, todayDate: '2026-09-29', now: NOW });
    expect(t).toMatchObject({ weather: null, reading: GENERAL_READING, facts: [] });
  });

  test('knows whether there has been a check-in today', () => {
    const t = today([ci(1, 1, 1)], { personal: true, todayDate: NOW.toISOString().slice(0, 10), now: NOW });
    expect(t.checkedInToday).toBe(true);
    expect(today([], { personal: true, todayDate: '2026-09-29', now: NOW }).checkedInToday).toBe(false);
  });
});
