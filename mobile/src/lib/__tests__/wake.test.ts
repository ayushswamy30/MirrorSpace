import { ApiError, NetworkError } from '../api';
import { withWakeRetries } from '../session';

jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));

const noWait = () => Promise.resolve();

test('a sleeping server is given time to wake, and the person is told', async () => {
  const run = jest
    .fn()
    .mockRejectedValueOnce(new NetworkError('timed out'))
    .mockRejectedValueOnce(new ApiError(503, 'starting', null))
    .mockResolvedValue('profile');
  const onWaking = jest.fn();
  await expect(withWakeRetries(run, onWaking, noWait)).resolves.toBe('profile');
  expect(run).toHaveBeenCalledTimes(3);
  expect(onWaking).toHaveBeenCalled();
});

test('a real refusal is not retried', async () => {
  const run = jest.fn().mockRejectedValue(new ApiError(401, 'no', null));
  await expect(withWakeRetries(run, jest.fn(), noWait)).rejects.toBeInstanceOf(ApiError);
  expect(run).toHaveBeenCalledTimes(1);
});

test('it gives up after about a minute of trying', async () => {
  const run = jest.fn().mockRejectedValue(new NetworkError('offline'));
  await expect(withWakeRetries(run, jest.fn(), noWait)).rejects.toBeInstanceOf(NetworkError);
  expect(run).toHaveBeenCalledTimes(5);
});
