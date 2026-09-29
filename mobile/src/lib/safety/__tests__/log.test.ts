import { getDatabase } from '../../db/database';
import { kv } from '../../db/kv';
import { recordSafetyEvent, reflectionsPaused } from '../log';

jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));

const runAsync = jest.fn();
const now = new Date('2026-09-29T10:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDatabase).mockResolvedValue({ runAsync } as never);
});

test('an event is its tier, source and time — nothing else', async () => {
  await recordSafetyEvent('elevated', 'check_in', now);

  expect(runAsync).toHaveBeenCalledWith(
    'INSERT INTO safety_events (tier, source, created_at) VALUES (?, ?, ?)',
    'elevated',
    'check_in',
    now.toISOString()
  );
  expect(kv.set).not.toHaveBeenCalled();
});

test('an acute event pauses reflections for a day', async () => {
  await recordSafetyEvent('acute', 'check_in', now);

  expect(kv.set).toHaveBeenCalledWith('safety.reflectionsPausedUntil', '2026-09-30T10:00:00.000Z');
});

test('reflections are paused only until the pause runs out', async () => {
  jest.mocked(kv.get).mockResolvedValue('2026-09-30T10:00:00.000Z');
  expect(await reflectionsPaused(now)).toBe(true);
  expect(await reflectionsPaused(new Date('2026-09-30T10:00:01.000Z'))).toBe(false);

  jest.mocked(kv.get).mockResolvedValue(null);
  expect(await reflectionsPaused(now)).toBe(false);
});
