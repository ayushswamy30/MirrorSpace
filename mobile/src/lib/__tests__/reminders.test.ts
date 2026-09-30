import * as Notifications from 'expo-notifications';

import { allCheckIns, localDate, type CheckIn } from '../checkIns';
import { kv } from '../db/kv';
import { DEFAULT_TIME, nextReminder, quietWhileOpen, sendTestReminder, syncReminder, usualTime } from '../reminders';

jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../runtime', () => ({ inExpoGo: false }));
jest.mock('../checkIns', () => ({ ...jest.requireActual('../checkIns'), allCheckIns: jest.fn() }));

const NOW = new Date(2026, 8, 29, 12, 0);

function at(daysAgo: number, hour: number, minute = 0): CheckIn {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, hour, minute);
  return { id: `${daysAgo}-${hour}`, createdAt: d.toISOString(), localDate: localDate(d), emotion: 'x', energy: 1, pleasantness: 1, tags: [], note: null };
}

beforeEach(() => jest.clearAllMocks());

test('the usual time is the median check-in time, to the quarter hour', () => {
  expect(usualTime([at(1, 21, 40), at(2, 22, 10), at(3, 20, 50)], NOW)).toBe(21 * 60 + 45);
});

test('fewer than three recent check-ins keep the default', () => {
  expect(usualTime([at(1, 8), at(2, 8)], NOW)).toBe(DEFAULT_TIME);
  expect(usualTime([at(20, 8), at(21, 8), at(22, 8)], NOW)).toBe(DEFAULT_TIME);
});

test('today if it is still ahead and there is no check-in yet; otherwise tomorrow', () => {
  const nine = 21 * 60;
  expect(nextReminder(nine, false, NOW)).toEqual(new Date(2026, 8, 29, 21, 0));
  expect(nextReminder(nine, true, NOW)).toEqual(new Date(2026, 8, 30, 21, 0));
  expect(nextReminder(9 * 60, false, NOW)).toEqual(new Date(2026, 8, 30, 9, 0));
});

test('with reminders off, nothing is left pending', async () => {
  jest.mocked(kv.get).mockResolvedValue('0');
  expect(await syncReminder(NOW)).toBeNull();
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('with reminders on, exactly one is scheduled, and it says nothing personal', async () => {
  jest.mocked(kv.get).mockResolvedValue('1');
  jest.mocked(allCheckIns).mockResolvedValue([at(0, 9)]);

  const when = await syncReminder(NOW);

  expect(when).toEqual(new Date(2026, 8, 30, 21, 0));
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const [request] = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0];
  expect(request.content).toEqual({ title: 'MirrorSpace', body: 'A word for today, if you have one.' });
});

test('a test reminder arrives in a few seconds, only once reminders are on', async () => {
  jest.mocked(kv.get).mockResolvedValue('0');
  expect(await sendTestReminder()).toBe(false);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

  jest.mocked(kv.get).mockResolvedValue('1');
  expect(await sendTestReminder()).toBe(true);
  expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: expect.objectContaining({ data: { test: true } }),
    trigger: { type: 'timeInterval', seconds: 5, channelId: 'reminders' }
  });
});

test('with the app open, only the test reminder shows a banner', async () => {
  quietWhileOpen();
  const { handleNotification } = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0]!;
  const note = (data: Record<string, unknown>) => ({ request: { content: { data } } }) as never;

  expect((await handleNotification(note({ test: true }))).shouldShowBanner).toBe(true);
  expect((await handleNotification(note({}))).shouldShowBanner).toBe(false);
});
