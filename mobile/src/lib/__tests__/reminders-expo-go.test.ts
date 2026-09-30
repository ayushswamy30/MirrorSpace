import * as Notifications from 'expo-notifications';

import { kv } from '../db/kv';
import { enableReminders, remindersEnabled, remindersSupported, syncReminder } from '../reminders';

// In Expo Go on Android, expo-notifications throws as soon as it loads.
// Nothing here may touch it.
jest.mock('../runtime', () => ({ inExpoGo: true }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(async () => '1'), set: jest.fn() } }));

test('in Expo Go reminders are off, and notifications are never loaded', async () => {
  expect(remindersSupported).toBe(false);
  expect(await remindersEnabled()).toBe(false);
  expect(await enableReminders()).toBe(false);
  expect(await syncReminder()).toBeNull();

  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(kv.set).not.toHaveBeenCalled();
});
