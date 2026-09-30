import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBatches, deadTokens, MESSAGES, parseRegistration, PushValidationError } from '../../lib/push.js';

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

test('only real Expo push tokens are registered', () => {
  assert.deepEqual(parseRegistration({ token: TOKEN, platform: 'android' }), { token: TOKEN, platform: 'android' });
  assert.throws(() => parseRegistration({ token: 'https://evil.example', platform: 'android' }), PushValidationError);
  assert.throws(() => parseRegistration({ token: TOKEN, platform: 'web' }), PushValidationError);
});

test('nothing personal reaches a lock screen', () => {
  for (const { body } of Object.values(MESSAGES)) {
    assert.doesNotMatch(body, /clear|mild|overcast|fog|storm/i);
  }
  const [batch] = buildBatches([TOKEN], 'low');
  assert.deepEqual(batch[0].data, { url: '/circle' });
  assert.equal(batch[0].channelId, 'circle');
});

test('messages go out in hundreds, as Expo asks', () => {
  const tokens = Array.from({ length: 250 }, (_, i) => `ExpoPushToken[token${String(i).padStart(6, '0')}]`);
  assert.deepEqual(buildBatches(tokens, 'nudge').map(b => b.length), [100, 100, 50]);
});

test('tokens for uninstalled apps are forgotten', () => {
  const batch = buildBatches(['ExpoPushToken[aaaaaaaaaa]', 'ExpoPushToken[bbbbbbbbbb]'], 'nudge')[0];
  const response = { data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] };
  assert.deepEqual(deadTokens(batch, response), ['ExpoPushToken[bbbbbbbbbb]']);
});
