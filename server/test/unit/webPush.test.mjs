import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPushEndpoint, parseSchedule, parseSubscription, webMessage, worthSending, WebPushValidationError } from '../../lib/webPush.js';

const KEYS = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
const NOW = new Date('2026-10-12T12:00:00Z');
const later = ms => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 3600 * 1000;

test('only the browsers’ own push services are accepted', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QGx',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x'
  ]) {
    assert.equal(isPushEndpoint(ok), true, ok);
  }
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/x',
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.example/x',
    'https://user@web.push.apple.com/x',
    'https://169.254.169.254/latest',
    'not a url'
  ]) {
    assert.equal(isPushEndpoint(bad), false, bad);
  }
});

test('a subscription needs its two keys', () => {
  const endpoint = 'https://web.push.apple.com/QGx';
  assert.deepEqual(parseSubscription({ endpoint, keys: KEYS }), { endpoint, ...KEYS });
  assert.throws(() => parseSubscription({ endpoint, keys: { ...KEYS, auth: 'x' } }), WebPushValidationError);
  assert.throws(() => parseSubscription({ endpoint: 'https://evil.example/x', keys: KEYS }), WebPushValidationError);
  assert.throws(() => parseSubscription(undefined), WebPushValidationError);
});

test('the schedule keeps the next reminder and each sealed letter, nothing past', () => {
  const rows = parseSchedule({ reminderAt: later(9 * HOUR), letters: [later(-HOUR), later(90 * 24 * HOUR)] }, NOW);
  assert.deepEqual(rows, [
    { kind: 'reminder', sendAt: later(9 * HOUR) },
    { kind: 'letter', sendAt: later(90 * 24 * HOUR) }
  ]);
  assert.deepEqual(parseSchedule({ reminderAt: null }, NOW), []);
});

test('waiting reflections are kept too; with alerts off, only the reminder', () => {
  const body = { reminderAt: later(9 * HOUR), letters: [later(90 * 24 * HOUR)], reflections: [later(3 * HOUR)] };
  assert.deepEqual(
    parseSchedule(body, NOW).map(r => r.kind),
    ['reminder', 'letter', 'reflection']
  );
  assert.deepEqual(parseSchedule({ ...body, alerts: false }, NOW), [{ kind: 'reminder', sendAt: later(9 * HOUR) }]);
  assert.throws(() => parseSchedule({ ...body, alerts: 'no' }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ reflections: [later(5 * 24 * HOUR)] }, NOW), /too far ahead/);
});

test('a week of reminders and 11:11 notes, each note with its two lines', () => {
  const notes = [1, 2].map(d => ({ at: later(d * 24 * HOUR), title: 'Go gently today.', body: 'A grey stretch lately.' }));
  const rows = parseSchedule({ reminders: [later(9 * HOUR), later(33 * HOUR)], notes, alerts: false }, NOW);
  assert.deepEqual(rows, [
    { kind: 'reminder', sendAt: later(9 * HOUR) },
    { kind: 'reminder', sendAt: later(33 * HOUR) },
    { kind: 'daily', sendAt: later(24 * HOUR), title: 'Go gently today.', body: 'A grey stretch lately.' },
    { kind: 'daily', sendAt: later(48 * HOUR), title: 'Go gently today.', body: 'A grey stretch lately.' }
  ]);
  // Line breaks and control characters are flattened; nothing empty or long gets through.
  assert.equal(parseSchedule({ notes: [{ ...notes[0], body: 'one\ntwo' }] }, NOW)[0].body, 'one two');
  assert.throws(() => parseSchedule({ notes: [{ ...notes[0], title: '' }] }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ notes: [{ ...notes[0], body: 'x'.repeat(201) }] }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ notes: [{ ...notes[0], title: 7 }] }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ notes: Array(9).fill(notes[0]) }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ reminders: Array(9).fill(later(HOUR)) }, NOW), WebPushValidationError);
});

test('the schedule refuses what the app would never ask for', () => {
  assert.throws(() => parseSchedule({ reminderAt: later(10 * 24 * HOUR) }, NOW), /too far ahead/);
  assert.throws(() => parseSchedule({ notes: [{ at: later(10 * 24 * HOUR), title: 'a', body: 'b' }] }, NOW), /too far ahead/);
  assert.throws(() => parseSchedule({ reminderAt: 'tonight' }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ letters: 'soon' }, NOW), WebPushValidationError);
  assert.throws(() => parseSchedule({ letters: Array(101).fill(later(HOUR)) }, NOW), WebPushValidationError);
});

test('nothing personal, never "Lowkei" as the title, and a tap goes somewhere the app knows', () => {
  for (const kind of ['reminder', 'test', 'letter', 'reflection', 'request', 'accepted', 'nudge', 'low']) {
    const message = JSON.parse(webMessage(kind));
    assert.notEqual(message.title, 'Lowkei');
    assert.ok(message.title.length > 0, kind);
    assert.doesNotMatch(message.title, /clear|mild|overcast|fog|storm/i);
    assert.ok(['/', '/circle', '/check-in?mode=letter', '/check-in?mode=vent'].includes(message.url), kind);
  }
  assert.equal(JSON.parse(webMessage('low')).url, '/circle');
  assert.throws(() => webMessage('anything'));
});

test('the daily note, and a test of it, say what the phone wrote', () => {
  const text = { title: 'Go gently today.', body: 'A grey stretch lately.' };
  assert.deepEqual(JSON.parse(webMessage('daily', text)), { ...text, url: '/', tag: 'daily' });
  assert.deepEqual(JSON.parse(webMessage('test', text)), { ...text, url: '/', tag: 'daily' });
  assert.throws(() => webMessage('daily', null), WebPushValidationError);
});

test('a reminder hours late is let go; a letter never is', () => {
  const at = new Date(NOW.getTime() - 3 * HOUR).toISOString();
  assert.equal(worthSending({ kind: 'reminder', send_at: at }, NOW), false);
  assert.equal(worthSending({ kind: 'reminder', send_at: later(-5 * 60 * 1000) }, NOW), true);
  assert.equal(worthSending({ kind: 'daily', send_at: at }, NOW), false);
  assert.equal(worthSending({ kind: 'letter', send_at: at }, NOW), true);
});
