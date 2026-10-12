import * as Notifications from 'expo-notifications';

import { allCheckIns } from '../checkIns';
import { kv } from '../db/kv';
import { disableReminders, enableReminders, remindersSupported, sendTestReminder, syncReminder } from '../reminders';
import { askWebPush, sendWebTest, syncWebPush } from '../webPush';

// The web app opened from a Home Screen: the server sends what a phone would schedule.
jest.mock('../webPush', () => ({
  webPushSupported: true,
  askWebPush: jest.fn(() => Promise.resolve(true)),
  syncWebPush: jest.fn(() => Promise.resolve(true)),
  sendWebTest: jest.fn(() => Promise.resolve(true))
}));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../checkIns', () => ({ ...jest.requireActual('../checkIns'), allCheckIns: jest.fn(() => Promise.resolve([])) }));

const NOW = new Date(2026, 9, 12, 12, 0);

beforeEach(() => jest.clearAllMocks());

test('on a Home Screen, reminders are supported', () => {
  expect(remindersSupported).toBe(true);
});

test('the server is told the next reminder; nothing is scheduled on the device', async () => {
  jest.mocked(kv.get).mockResolvedValue('1');
  jest.mocked(allCheckIns).mockResolvedValue([]);

  const when = await syncReminder(NOW);

  expect(when).toEqual(new Date(2026, 9, 12, 21, 0));
  expect(syncWebPush).toHaveBeenCalledWith(when, NOW);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('with reminders off, the server still gets the address and letters, with no reminder', async () => {
  jest.mocked(kv.get).mockResolvedValue('0');
  expect(await syncReminder(NOW)).toBeNull();
  expect(syncWebPush).toHaveBeenCalledWith(null, NOW);
});

test('switching on asks the browser before anything else', async () => {
  const order: string[] = [];
  jest.mocked(askWebPush).mockImplementation(async () => (order.push('ask'), true));
  jest.mocked(kv.set).mockImplementation(async () => void order.push('save'));

  expect(await enableReminders()).toBe(true);
  expect(order[0]).toBe('ask');

  jest.mocked(askWebPush).mockResolvedValue(false);
  jest.mocked(kv.set).mockClear();
  expect(await enableReminders()).toBe(false);
  expect(kv.set).not.toHaveBeenCalled();
});

test('switching off clears the reminder on the server', async () => {
  jest.mocked(kv.get).mockResolvedValue('0');
  await disableReminders();
  expect(kv.set).toHaveBeenCalledWith('reminder.enabled', '0');
  expect(syncWebPush).toHaveBeenCalledWith(null, expect.any(Date));
});

test('the test reminder comes from the server, only once reminders are on', async () => {
  jest.mocked(kv.get).mockResolvedValue('0');
  expect(await sendTestReminder()).toBe(false);
  expect(sendWebTest).not.toHaveBeenCalled();

  jest.mocked(kv.get).mockResolvedValue('1');
  expect(await sendTestReminder()).toBe(true);
  expect(sendWebTest).toHaveBeenCalled();
});
