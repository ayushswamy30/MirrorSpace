import * as Notifications from 'expo-notifications';

import { allCheckIns, localDate, type CheckIn } from '../checkIns';
import { kv } from '../db/kv';
import { DEFAULT_TIME, nextReminder, nextReminders, quietWhileOpen, sendTestReminder, syncReminder, usualTime } from '../reminders';

jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../runtime', () => ({ inExpoGo: false }));
jest.mock('../checkIns', () => ({ ...jest.requireActual('../checkIns'), allCheckIns: jest.fn(() => Promise.resolve([])) }));
jest.mock('../sleep', () => ({ ...jest.requireActual('../sleep'), allSleep: jest.fn(() => Promise.resolve([])) }));
jest.mock('../vents', () => ({ ...jest.requireActual('../vents'), listVents: jest.fn(() => Promise.resolve([])) }));

const NOW = new Date(2026, 8, 29, 12, 0);

function at(daysAgo: number, hour: number, minute = 0): CheckIn {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, hour, minute);
  return { id: `${daysAgo}-${hour}`, createdAt: d.toISOString(), localDate: localDate(d), emotion: 'x', energy: 1, pleasantness: 1, tags: [], note: null };
}

/** kv answers: reminders on or off; the daily note on unless said otherwise. */
function settings(reminder: '0' | '1', daily: '0' | '1' | null = null) {
  jest.mocked(kv.get).mockImplementation(async (k: string) => (k === 'reminder.enabled' ? reminder : k === 'daily.enabled' ? daily : null));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
});

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

test('a week of reminders, one a day, from the next one', () => {
  const week = nextReminders(21 * 60, true, NOW);
  expect(week).toHaveLength(7);
  expect(week[0]).toEqual(new Date(2026, 8, 30, 21, 0));
  expect(week[6]).toEqual(new Date(2026, 9, 6, 21, 0));
});

const pending = (identifier: string, data?: Record<string, unknown>) => ({ identifier, content: { data }, trigger: null }) as never;

test('with everything off, nothing is left pending — but letters and reflections keep their day', async () => {
  settings('0', '0');
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([
      pending('reminder'),
      pending('note', { kind: 'daily', url: '/' }),
      pending('letter', { url: '/check-in?mode=letter' }),
      pending('reflection', { url: '/check-in?mode=vent' })
    ]);
  expect(await syncReminder(NOW)).toBeNull();
  expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(jest.mocked(Notifications.cancelScheduledNotificationAsync).mock.calls.map(c => c[0])).toEqual(['reminder', 'note']);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('with reminders on, a week is scheduled, saying nothing personal and not "Lowkei" twice', async () => {
  settings('1', '0');
  jest.mocked(allCheckIns).mockResolvedValue([at(0, 9)]);

  const when = await syncReminder(NOW);

  expect(when).toEqual(new Date(2026, 8, 30, 21, 0));
  const calls = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls;
  expect(calls).toHaveLength(7);
  expect(calls[0][0].content).toEqual({ title: 'A word for today, if you have one.' });
});

test('the daily note comes every day at 11:11, with the day’s headline and line', async () => {
  settings('0');
  jest.mocked(allCheckIns).mockResolvedValue([]);

  await syncReminder(NOW);

  const calls = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls;
  expect(calls).toHaveLength(7);
  const first = calls[0][0];
  expect(first.trigger).toEqual(expect.objectContaining({ date: new Date(2026, 8, 30, 11, 11) }));
  expect(calls[6][0].trigger).toEqual(expect.objectContaining({ date: new Date(2026, 9, 6, 11, 11) }));
  expect(first.content.title).not.toBe('Lowkei');
  expect(first.content.body).toBeTruthy();
  expect(first.content.data).toEqual({ kind: 'daily', url: '/' });
  // Different words on different days.
  expect(new Set(calls.map(c => c[0].content.title)).size).toBeGreaterThan(1);
});

test('without permission there is no daily note', async () => {
  settings('0');
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
  expect(await syncReminder(NOW)).toBeNull();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('the test is today’s note, in a few seconds, once something is on', async () => {
  settings('0', '0');
  expect(await sendTestReminder()).toBe(false);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

  settings('1', '0');
  expect(await sendTestReminder()).toBe(true);
  expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: expect.objectContaining({ title: expect.any(String), body: expect.any(String), data: { test: true } }),
    trigger: { type: 'timeInterval', seconds: 5, channelId: 'reminders' }
  });
  const [request] = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0];
  expect(request.content.title).not.toBe('Lowkei');
});

test('with the app open, only the test reminder shows a banner', async () => {
  quietWhileOpen();
  const { handleNotification } = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0]!;
  const note = (data: Record<string, unknown>) => ({ request: { content: { data } } }) as never;

  expect((await handleNotification(note({ test: true }))).shouldShowBanner).toBe(true);
  expect((await handleNotification(note({}))).shouldShowBanner).toBe(false);
});
