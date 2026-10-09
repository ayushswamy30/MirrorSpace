import { localDate, type CheckIn } from '../checkIns';
import { getDatabase } from '../db/database';
import { compare, dayOf, setKept, startExperiment, stateOf, type Experiment } from '../experiments';
import { night } from '../sleep';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id-1' }));

const runAsync = jest.fn();
jest.mocked(getDatabase).mockResolvedValue({ runAsync } as never);

const START = '2026-10-01';
const base: Experiment = { id: 'e', title: 'In bed by 23:30', startsOn: START, endsOn: '2026-10-07', kept: [], stoppedOn: null };

function on(date: string, pleasantness: number, energy = -1): CheckIn {
  const at = new Date(`${date}T12:00:00`);
  return { id: `${date}-${pleasantness}`, createdAt: at.toISOString(), localDate: localDate(at), emotion: 'calm', energy, pleasantness, tags: [], note: null };
}

function nightOn(date: string, bed: number, wake: number) {
  return night(bed, wake, new Date(`${date}T12:00:00`));
}

test('a new experiment runs seven days from today', async () => {
  const e = await startExperiment('  In bed by 23:30 ', new Date(2026, 9, 1, 9));
  expect(e).toMatchObject({ title: 'In bed by 23:30', startsOn: '2026-10-01', endsOn: '2026-10-07', kept: [] });
  expect(runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO experiments'), 'id-1', expect.any(String), 'In bed by 23:30', '2026-10-01', '2026-10-07');
});

test('days count from one, and the state follows the calendar', () => {
  expect(dayOf(base, '2026-10-03')).toBe(3);
  expect(dayOf(base, '2026-10-20')).toBe(7);
  expect(stateOf(base, '2026-10-07')).toBe('running');
  expect(stateOf(base, '2026-10-08')).toBe('finished');
  expect(stateOf({ ...base, stoppedOn: '2026-10-03' }, '2026-10-03')).toBe('stopped');
});

test('marking a day kept toggles it', async () => {
  const kept = await setKept(base, '2026-10-02', true);
  expect(kept.kept).toEqual(['2026-10-02']);
  expect((await setKept(kept, '2026-10-02', false)).kept).toEqual([]);
});

test('the week before is set beside the week of it', () => {
  const before = ['09-24', '09-25', '09-26', '09-27'].map(d => on(`2026-${d}`, -2));
  const during = ['10-01', '10-02', '10-03', '10-04'].map(d => on(`2026-${d}`, 2, 3));
  const nightsBefore = ['09-25', '09-26', '09-27'].map(d => nightOn(`2026-${d}`, 1 * 60, 7 * 60));
  const nightsDuring = ['10-02', '10-03', '10-04'].map(d => nightOn(`2026-${d}`, 23 * 60, 7 * 60));
  const c = compare({ ...base, kept: ['2026-10-01', '2026-10-02'] }, [...before, ...during], [...nightsBefore, ...nightsDuring], '2026-10-10');

  expect(c.days).toBe(7);
  expect(c.kept).toBe(2);
  expect(c.lines).toEqual([
    'Check-ins ran lighter during it (+4.0 vs the week before).',
    'Energy ran higher (+4.0).',
    'Nights averaged 8h, against 6h the week before.'
  ]);
});

test('too little logged on one side, no lines; a stop ends the comparison early', () => {
  const c = compare({ ...base, stoppedOn: '2026-10-03' }, [on('2026-10-01', 3)], [], '2026-10-10');
  expect(c.lines).toEqual([]);
  expect(c.days).toBe(3);
});
