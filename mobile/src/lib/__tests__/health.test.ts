import { Platform } from 'react-native';

import { setConsent } from '../account';
import { kv } from '../db/kv';
import { deleteBodyDays, setBodyConnected } from '../body';
import { connectBody, connectHealth, disconnectHealth, healthPlatform, nightsFromSessions, syncHealthSleep } from '../health';
import { deleteHealthNights, saveHealthNights } from '../sleep';

const mockHC = {
  initialize: jest.fn(async () => true),
  getSdkStatus: jest.fn(async () => 3),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
  revokeAllPermissions: jest.fn(async () => undefined),
  openHealthConnectSettings: jest.fn(),
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 }
};

jest.mock('react-native-health-connect', () => mockHC, { virtual: true });
jest.mock('../runtime', () => ({ inExpoGo: false }));
jest.mock('../account', () => ({ setConsent: jest.fn() }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../sleep', () => ({ saveHealthNights: jest.fn(), deleteHealthNights: jest.fn() }));
jest.mock('../body', () => ({
  ...jest.requireActual('../body'),
  syncBody: jest.fn(async () => 0),
  setBodyConnected: jest.fn(async () => undefined),
  deleteBodyDays: jest.fn(async () => undefined)
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(kv.get).mockResolvedValue('1');
  jest.mocked(setConsent).mockResolvedValue();
  mockHC.readRecords.mockResolvedValue({ records: [] });
});

afterEach(() => jest.restoreAllMocks());

const iso = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo, d, h, mi).toISOString();

describe('sessions → nights', () => {
  test('one night per morning: the longest session wins over a nap', () => {
    const nights = nightsFromSessions([
      { startTime: iso(2026, 8, 28, 23), endTime: iso(2026, 8, 29, 7) },
      { startTime: iso(2026, 8, 29, 14), endTime: iso(2026, 8, 29, 15, 30) }
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0]).toMatchObject({ minutes: 480, source: 'health' });
  });

  test('sessions under an hour or over twenty are not nights', () => {
    expect(
      nightsFromSessions([
        { startTime: iso(2026, 8, 29, 13), endTime: iso(2026, 8, 29, 13, 40) },
        { startTime: iso(2026, 8, 27, 0), endTime: iso(2026, 8, 28, 1) }
      ])
    ).toEqual([]);
  });
});

describe('connecting', () => {
  test('only sleep is asked for; once granted, consent is recorded and nights are read', async () => {
    mockHC.requestPermission.mockResolvedValue([{ accessType: 'read', recordType: 'SleepSession' }]);
    mockHC.readRecords.mockResolvedValue({
      records: [{ startTime: iso(2026, 8, 28, 23), endTime: iso(2026, 8, 29, 6, 30) }]
    });

    expect(await connectHealth()).toBe('connected');

    expect(mockHC.requestPermission).toHaveBeenCalledWith([{ accessType: 'read', recordType: 'SleepSession' }]);
    expect(setConsent).toHaveBeenCalledWith('health', true);
    expect(kv.set).toHaveBeenCalledWith('health.connected', '1');
    expect(jest.mocked(saveHealthNights).mock.calls[0][0]).toHaveLength(1);
  });

  test('saying no on Android reads nothing and records nothing', async () => {
    mockHC.requestPermission.mockResolvedValue([]);
    expect(await connectHealth()).toBe('declined');
    expect(setConsent).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  test('if the consent cannot be recorded, the permission is handed back and nothing is read', async () => {
    mockHC.requestPermission.mockResolvedValue([{ accessType: 'read', recordType: 'SleepSession' }]);
    jest.mocked(setConsent).mockRejectedValue(new Error('offline'));

    expect(await connectHealth()).toBe('needs-connection');
    expect(mockHC.revokeAllPermissions).toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
    expect(mockHC.readRecords).not.toHaveBeenCalled();
  });

  test('turning it off forgets what was read and withdraws the consent', async () => {
    await disconnectHealth();
    expect(kv.set).toHaveBeenCalledWith('health.connected', '0');
    expect(deleteHealthNights).toHaveBeenCalled();
    expect(deleteBodyDays).toHaveBeenCalled();
    expect(setConsent).toHaveBeenCalledWith('health', false);
  });

  test('steps and heart are a second ask, for those three only', async () => {
    mockHC.requestPermission.mockResolvedValueOnce([{ accessType: 'read', recordType: 'Steps' }]);
    expect(await connectBody()).toBe('connected');
    expect(mockHC.requestPermission).toHaveBeenLastCalledWith([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
      { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' }
    ]);
    expect(setBodyConnected).toHaveBeenCalledWith(true);
  });

  test('not connected, nothing is read', async () => {
    jest.mocked(kv.get).mockResolvedValue('0');
    expect(await syncHealthSleep()).toBe(0);
    expect(mockHC.readRecords).not.toHaveBeenCalled();
  });
});

test('on iPhone it says Apple Health comes later, and never loads the Android module', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  expect(healthPlatform()).toBe('not-android');
  expect(await connectHealth()).toBe('unavailable');
  expect(mockHC.initialize).not.toHaveBeenCalled();
});
