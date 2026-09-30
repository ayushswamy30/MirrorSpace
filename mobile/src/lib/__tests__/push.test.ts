import * as Notifications from 'expo-notifications';

import { api } from '../api';
import { alertTarget, askForAlerts, registerForAlerts } from '../push';

jest.mock('../runtime', () => ({ inExpoGo: false }));
jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../api', () => ({ api: { put: jest.fn(() => Promise.resolve()) } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'p1' } } } } }));

beforeEach(() => jest.clearAllMocks());

test('without permission, nothing is registered and nothing is asked', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
  expect(await registerForAlerts()).toBe(false);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
});

test('with permission, the token goes to the API for this project', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
  expect(await registerForAlerts()).toBe(true);
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'p1' });
  expect(api.put).toHaveBeenCalledWith('/user/push-token', { token: 'ExponentPushToken[test-token-0000]', platform: 'ios' });
});

test('asking prompts once, and a no stays a no', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
  expect(await askForAlerts()).toBe(false);
  expect(api.put).not.toHaveBeenCalled();
});

test('a tapped alert opens only places the app knows', () => {
  expect(alertTarget({ url: '/circle' })).toBe('/circle');
  expect(alertTarget({ url: 'https://example.com' })).toBeNull();
  expect(alertTarget(null)).toBeNull();
});
