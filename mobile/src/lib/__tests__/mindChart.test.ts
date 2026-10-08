import { localDate, type CheckIn } from '../checkIns';
import { kv } from '../db/kv';
import {
  currentMindChart,
  drawMindChart,
  hours,
  leans,
  needsRedraw,
  recoveries,
  rhythm,
  social,
  stress
} from '../mindChart';
import { night } from '../sleep';
import * as checkInsModule from '../checkIns';
import * as sleepModule from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../checkIns', () => ({ ...jest.requireActual('../checkIns'), allCheckIns: jest.fn() }));
jest.mock('../sleep', () => ({ ...jest.requireActual('../sleep'), allSleep: jest.fn() }));

const NOW = new Date(2026, 9, 8, 21, 0);

function at(daysAgo: number, hour: number, pleasantness: number, opts: { energy?: number; emotion?: string; tags?: string[] } = {}): CheckIn {
  const when = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, hour, 0);
  return {
    id: `${daysAgo}-${hour}-${pleasantness}`,
    createdAt: when.toISOString(),
    localDate: localDate(when),
    emotion: opts.emotion ?? 'calm',
    energy: opts.energy ?? -1,
    pleasantness,
    tags: opts.tags ?? [],
    note: null
  };
}

function nights(bed: number, wake: number, count: number) {
  return Array.from({ length: count }, (_, i) => night(bed, wake, new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - i)));
}

describe('rhythm', () => {
  test('waits for five nights', () => {
    expect(rhythm(nights(23 * 60, 7 * 60, 3))).toMatchObject({ value: null, line: 'Needs 2 more nights of sleep logged.' });
  });

  test('reads early, middle and late nights from where they centre', () => {
    expect(rhythm(nights(22 * 60, 6 * 60, 5)).value).toBe('Early riser');
    expect(rhythm(nights(23 * 60 + 30, 7 * 60 + 30, 5)).value).toBe('In between');
    const late = rhythm(nights(1 * 60 + 30, 9 * 60 + 30, 6));
    expect(late.value).toBe('Night owl');
    expect(late.line).toBe('Your nights run late — asleep around 01:30, up around 09:30.');
    expect(late.receipt).toBe('midpoint 05:30 · asleep ~01:30 · up ~09:30 · 6 nights');
  });
});

describe('hours', () => {
  test('needs two times of day with three check-ins each', () => {
    expect(hours([at(0, 9, 2), at(1, 9, 2), at(2, 9, 2)]).value).toBeNull();
  });

  test('names the lightest time of day, with its evidence', () => {
    const list = [at(0, 9, 3), at(1, 9, 2), at(2, 9, 4), at(0, 23, -3), at(1, 1, -2), at(2, 23, -4)];
    const placed = hours(list);
    expect(placed.value).toBe('Mornings');
    expect(placed.line).toBe('Check-ins have run lightest in the morning, and heaviest late at night.');
    expect(placed.receipt).toBe('mornings +3.0 (3) · nights −3.0 (3)');
  });
});

describe('stress', () => {
  test('heavy check-ins mostly charged read as storm', () => {
    const list = [
      at(0, 9, -3, { energy: 3, emotion: 'tense' }),
      at(1, 9, -2, { energy: 2, emotion: 'tense' }),
      at(2, 9, -4, { energy: 4, emotion: 'wired' }),
      at(3, 9, -2, { energy: -2, emotion: 'drained' })
    ];
    expect(stress(list)).toMatchObject({ value: 'Storm', receipt: '3 of 4 heavy check-ins charged · tense, drained, wired' });
  });

  test('few heavy days among many is said plainly, not waited for', () => {
    const list = Array.from({ length: 12 }, (_, i) => at(i, 9, 3));
    expect(stress(list).line).toMatch(/^Few heavy check-ins so far/);
  });
});

test('restorers and drains need a clear gap and enough uses', () => {
  const list = [
    ...[0, 1, 2].map(d => at(d, 9, 4, { tags: ['outside'] })),
    ...[3, 4, 5].map(d => at(d, 9, -4, { tags: ['work'] })),
    ...[6, 7, 8].map(d => at(d, 9, 0, { tags: ['home'] })),
    at(9, 9, 4, { tags: ['travel'] })
  ];
  const { restorers, drains } = leans(list);
  expect(restorers.map(r => r.tag)).toEqual(['outside']);
  expect(drains.map(d => d.tag)).toEqual(['work']);
});

test('recovery counts calendar days from a heavy day to the next light one', () => {
  // heavy, quiet, light · heavy, overcast, heavy, light
  const list = [at(9, 9, -4), at(7, 9, 3), at(5, 9, -4), at(4, 9, -1), at(3, 9, -4), at(2, 9, 3), at(0, 9, -4)];
  const from = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 10);
  expect(recoveries(list, from, NOW)).toEqual([2, 3]);
});

test('people or alone compares the two kinds of check-in', () => {
  const list = [
    ...[0, 1, 2].map(d => at(d, 9, 3, { tags: ['friends'] })),
    ...[3, 4, 5].map(d => at(d, 9, -1, { tags: ['alone'] }))
  ];
  expect(social(list)).toMatchObject({ value: 'Charged by people', receipt: 'with people +3.0 (3) · alone −1.0 (3)' });
  expect(social(list.slice(0, 4)).line).toBe('Needs 2 more check-ins tagged with people, or “alone”.');
});

test('the chart only reads the ninety days up to when it was drawn', () => {
  const old = at(120, 9, 4, { tags: ['outside'] });
  const later = new Date(NOW.getTime() + 60 * 60 * 1000);
  const after = { ...at(0, 9, 4), createdAt: later.toISOString() };
  const chart = drawMindChart([old, after], [], NOW);
  expect(chart.hours.value).toBeNull();
  expect(chart.complete).toBe(false);
});

test('a complete chart waits a month; an incomplete one redraws', () => {
  const chart = { ...drawMindChart([], [], NOW), complete: true };
  expect(needsRedraw(chart, new Date(NOW.getTime() + 29 * 24 * 3600 * 1000))).toBe(false);
  expect(needsRedraw(chart, new Date(NOW.getTime() + 30 * 24 * 3600 * 1000))).toBe(true);
  expect(needsRedraw({ ...chart, complete: false }, NOW)).toBe(true);
});

test('the drawing date is kept, and a fresh one stored when due', async () => {
  jest.mocked(checkInsModule.allCheckIns).mockResolvedValue([]);
  jest.mocked(sleepModule.allSleep).mockResolvedValue([]);
  jest.mocked(kv.get).mockResolvedValue(null);
  const chart = await currentMindChart(NOW);
  expect(chart.drawnAt).toBe(NOW.toISOString());
  expect(kv.set).toHaveBeenCalledWith('mindChart.drawnAt', NOW.toISOString());
});
