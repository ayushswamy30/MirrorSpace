import { bodyFacts, dailyAverages, syncBody, type BodyDay } from '../body';
import { localDate, type CheckIn } from '../checkIns';
import { getDatabase } from '../db/database';
import { kv } from '../db/kv';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));

const NOW = new Date(2026, 9, 8, 21, 0);

function day(back: number, values: Partial<BodyDay>): BodyDay {
  return { date: localDate(new Date(2026, 9, 8 - back)), steps: null, restingHr: null, hrv: null, ...values };
}

function checkIn(back: number, pleasantness: number): CheckIn {
  const at = new Date(2026, 9, 8 - back, 12);
  return { id: `${back}`, createdAt: at.toISOString(), localDate: localDate(at), emotion: 'calm', energy: -1, pleasantness, tags: [], note: null };
}

test('readings through a day become that day’s average', () => {
  const avg = dailyAverages([
    { time: new Date(2026, 9, 1, 7).toISOString(), value: 58 },
    { time: new Date(2026, 9, 1, 22).toISOString(), value: 62 },
    { time: new Date(2026, 9, 2, 7).toISOString(), value: 70 }
  ]);
  expect(avg.get('2026-10-01')).toBe(60);
  expect(avg.get('2026-10-02')).toBe(70);
});

test('walking-more days set against the rest, with the steps line as the receipt', () => {
  const days = [1, 2, 3, 4, 5, 6].map(b => day(b, { steps: b <= 3 ? 9000 : 2000 }));
  const checkIns = [1, 2, 3, 4, 5, 6].map(b => checkIn(b, b <= 3 ? 3 : -2));
  const [fact] = bodyFacts(days, checkIns, NOW);
  expect(fact).toMatchObject({ key: 'steps-mood', text: 'On days you walked more, check-ins tended to be lighter.' });
  expect(fact.receipt).toMatch(/^over 5,?500 steps: 3 days · \+5\.0 vs the rest$/);
});

test('this week’s heart against the usual: higher resting rate, lower HRV', () => {
  const usual = [10, 12, 14, 16, 18, 20].map(b => day(b, { restingHr: 58, hrv: 50 }));
  const week = [0, 1, 2].map(b => day(b, { restingHr: 66, hrv: 38 }));
  const facts = bodyFacts([...usual, ...week], [], NOW);
  expect(facts.map(f => f.key)).toEqual(['resting-hr', 'hrv']);
  expect(facts[0].receipt).toBe('66 bpm this week · usually 58 · 3 days');
});

test('nothing is read unless steps and heart were allowed', async () => {
  jest.mocked(kv.get).mockResolvedValue(null);
  const H = { readRecords: jest.fn(), aggregateRecord: jest.fn() };
  expect(await syncBody(H as never, NOW)).toBe(0);
  expect(H.readRecords).not.toHaveBeenCalled();
});

test('the first sync reads a month; steps are aggregated per day', async () => {
  jest.mocked(kv.get).mockResolvedValue('1');
  const runAsync = jest.fn();
  jest.mocked(getDatabase).mockResolvedValue({ getAllAsync: async () => [], runAsync } as never);
  const H = {
    readRecords: jest.fn(async (type: string) => ({
      records: type === 'RestingHeartRate' ? [{ time: new Date(2026, 9, 8, 7).toISOString(), beatsPerMinute: 61 }] : []
    })),
    aggregateRecord: jest.fn(async () => ({ COUNT_TOTAL: 5000 }))
  };
  expect(await syncBody(H as never, NOW)).toBe(30);
  expect(H.aggregateRecord).toHaveBeenCalledTimes(30);
  expect(runAsync).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO body_days'), '2026-10-08', 5000, 61, null);
});
