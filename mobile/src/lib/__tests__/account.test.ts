import { buildExport, eraseEverything, setConsent } from '../account';
import { api } from '../api';
import { destroyLocalData } from '../db/database';
import { supabase } from '../supabase';

jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: {} } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('../api', () => ({ api: { get: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../db/database', () => ({ destroyLocalData: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: { auth: { signOut: jest.fn(() => Promise.resolve({})) } } }));
jest.mock('../checkIns', () => ({ allCheckIns: jest.fn(async () => [{ id: 'c1', emotion: 'calm' }]) }));
jest.mock('../vents', () => ({ listVents: jest.fn(async () => [{ id: 'v1', body: 'a page' }]) }));
jest.mock('../safetyPlan', () => ({ loadPlan: jest.fn(async () => ({ reasons: [{ text: 'my dog' }] })) }));
jest.mock('../safety/log', () => ({ listSafetyEvents: jest.fn(async () => [{ tier: 'low', source: 'vent' }]) }));

beforeEach(() => jest.clearAllMocks());

test('the export holds what is on the phone and what the server holds', async () => {
  jest.mocked(api.get).mockResolvedValue({ account: { id: 'u1' } });

  const data = await buildExport(new Date('2026-09-29T20:00:00Z'));

  expect(data.exportedAt).toBe('2026-09-29T20:00:00.000Z');
  expect(data.onThisPhone.checkIns).toEqual([{ id: 'c1', emotion: 'calm' }]);
  expect(data.onThisPhone.ventPages).toEqual([{ id: 'v1', body: 'a page' }]);
  expect(data.onThisPhone.safetyPlan).toEqual({ reasons: [{ text: 'my dog' }] });
  expect(data.server).toEqual({ account: { id: 'u1' } });
  expect(data.serverError).toBeUndefined();
});

test('offline, the export still carries everything on the phone and says what is missing', async () => {
  jest.mocked(api.get).mockRejectedValue(new Error('Network request failed'));

  const data = await buildExport();

  expect(data.onThisPhone.ventPages).toHaveLength(1);
  expect(data.server).toBeNull();
  expect(data.serverError).toBe('Network request failed');
});

test('erasing deletes the server account first, then the phone', async () => {
  const order: string[] = [];
  jest.mocked(api.delete).mockImplementation(async () => {
    order.push('server');
  });
  jest.mocked(destroyLocalData).mockImplementation(async () => {
    order.push('phone');
  });

  await eraseEverything();

  expect(order).toEqual(['server', 'phone']);
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('if the server cannot be reached, nothing on the phone is touched', async () => {
  jest.mocked(api.delete).mockRejectedValue(new Error('offline'));

  await expect(eraseEverything()).rejects.toThrow('offline');
  expect(destroyLocalData).not.toHaveBeenCalled();
});

test('a consent change names one purpose and the policy version', async () => {
  await setConsent('ai_reflections', false);
  expect(api.put).toHaveBeenCalledWith('/user/consents', {
    consents: { ai_reflections: false },
    policyVersion: expect.any(String)
  });
});
