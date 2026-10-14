import type { CheckIn } from '../checkIns';
import { generalReading, writeReading, type ReadingInput } from '../reading';
import type { SleepLog } from '../sleep';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 14, 11, 11);

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let n = 0;
function ci(hoursAgo: number, pleasantness: number, energy: number, extra: Partial<CheckIn> = {}, now = NOW): CheckIn {
  const at = new Date(now.getTime() - hoursAgo * HOUR);
  return { id: `c${n++}`, createdAt: at.toISOString(), localDate: key(at), emotion: 'tired', energy, pleasantness, tags: [], note: null, ...extra };
}

function input(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    weather: 'overcast',
    facts: [],
    checkIns: [],
    sleep: [],
    lastNight: null,
    pages: [],
    now: NOW,
    date: key(NOW),
    seed: 'person-a',
    ...over
  };
}

function shortNight(minutes: number): SleepLog {
  const wake = new Date(2026, 9, 14, 7, 0);
  return { wakeDate: key(wake), bedAt: new Date(wake.getTime() - minutes * 60 * 1000).toISOString(), wakeAt: wake.toISOString(), minutes };
}

test('the same person on the same day always reads the same', () => {
  const data = input({ checkIns: [ci(20, -1, -1, { tags: ['work'] })] });
  expect(writeReading(data)).toEqual(writeReading(data));
});

test('the headline changes from one day to the next', () => {
  for (let d = 0; d < 14; d++) {
    const today = new Date(NOW.getTime() + d * DAY);
    const tomorrow = new Date(today.getTime() + DAY);
    const a = writeReading(input({ now: today, date: key(today) }));
    const b = writeReading(input({ now: tomorrow, date: key(tomorrow) }));
    expect(a.headline).not.toBe(b.headline);
  }
});

test('the line under it never repeats the day before, even when little has changed', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    let before = '';
    for (let d = 0; d < 21; d++) {
      const now = new Date(NOW.getTime() + d * DAY);
      const checkIns = Array.from({ length: 8 }, (_, i) => ci(i * 20 + 14, -2, -1, { tags: i % 2 ? ['work'] : [] }, now));
      const facts = [{ key: 'unpleasant', text: 'It’s been a heavier week.', weight: 1 }];
      const { subtext } = writeReading(input({ seed, now, date: key(now), checkIns, facts }));
      expect(subtext).not.toBe(before);
      before = subtext;
    }
  }
});

test('two people with the same days do not read the same', () => {
  const days = Array.from({ length: 7 }, (_, d) => new Date(NOW.getTime() + d * DAY));
  const read = (seed: string) => days.map(day => writeReading(input({ seed, now: day, date: key(day) })).headline).join('|');
  expect(read('person-a')).not.toBe(read('person-b'));
});

test('a short night is what the day is about, when it is the only thing to go on', () => {
  const night = shortNight(5 * 60 + 20);
  const reading = writeReading(input({ checkIns: [ci(50, -1, -1)], sleep: [night], lastNight: night }));
  expect(reading.subtext).toMatch(/^Last night was 5h 20m\./);
  expect(reading.note).toBe('A short night behind you. Lower the bar a little today.');
  expect(reading.dos).toContain('An early night');
});

test('a few quiet days are met without guilt', () => {
  const reading = writeReading(input({ checkIns: [ci(4 * 24 + 2, 1, 1)] }));
  expect(reading.subtext).toMatch(/It’s been 4 days since your last check-in\. Nothing to catch up on/);
});

test('yesterday’s word is named on the page, never on the lock screen', () => {
  for (let d = 0; d < 30; d++) {
    const now = new Date(NOW.getTime() + d * DAY);
    const reading = writeReading(input({ now, date: key(now), checkIns: [ci(18, -3, -2, { emotion: 'hopeless' }, now)] }));
    expect(reading.note).not.toMatch(/hopeless/);
    if (reading.subtext.includes('hopeless')) expect(reading.subtext).toMatch(/Yesterday/);
  }
});

test('a tag that keeps coming up shapes the reading, with its own advice', () => {
  const checkIns = [1, 20, 40, 60].map(h => ci(h + 50, -2, -1, { tags: ['work'] }));
  const seen = new Set<string>();
  for (let d = 0; d < 20; d++) seen.add(writeReading(input({ checkIns, seed: `s${d}` })).subtext);
  expect([...seen].some(line => /“work” came up in 4 of your last 4 check-ins/.test(line))).toBe(true);
});

test('what they have been writing about is noticed, without quoting it', () => {
  const pages = [
    { createdAt: new Date(NOW.getTime() - 20 * HOUR).toISOString(), body: 'My boss moved the deadline again and the meeting ran late.' },
    { createdAt: new Date(NOW.getTime() - 40 * HOUR).toISOString(), body: 'Work again. Another deadline.' }
  ];
  const seen = new Set<string>();
  for (let d = 0; d < 20; d++) seen.add(writeReading(input({ checkIns: [ci(50, -1, -1)], pages, seed: `s${d}` })).subtext);
  const line = [...seen].find(l => l.startsWith('You’ve been writing about work lately.'));
  expect(line).toBeDefined();
  expect(line).not.toMatch(/boss|deadline|meeting/);
});

test('notes stay short enough for a lock screen', () => {
  for (const weather of ['clear', 'mild', 'overcast', 'fog', 'storm'] as const) {
    for (let d = 0; d < 10; d++) {
      const now = new Date(NOW.getTime() + d * DAY);
      const r = writeReading(input({ weather, now, date: key(now), checkIns: [ci(20, 1, 1, { tags: ['friends'] }, now)] }));
      expect(r.headline.length).toBeLessThanOrEqual(80);
      expect((r.note ?? '').length).toBeGreaterThan(0);
      expect((r.note ?? '').length).toBeLessThanOrEqual(200);
      expect(r.dos).toHaveLength(3);
      expect(r.donts).toHaveLength(3);
    }
  }
});

test('with nothing to read, the general reading still changes daily', () => {
  expect(writeReading(input({ weather: null }))).toEqual(generalReading('person-a', key(NOW)));
  expect(generalReading('a', '2026-10-14').headline).not.toBe(generalReading('a', '2026-10-15').headline);
});
