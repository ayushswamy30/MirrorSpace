// Circle, end to end against a running API (see session.mjs for tokens):
//
//   node test/circle.e2e.mjs
//
// Two fresh anonymous people find each other by code, share their weather,
// signal "running low", nudge, and leave — and each account is erased at the
// end, so nothing is left behind in the project.
import assert from 'node:assert/strict';

import { newSession } from './session.mjs';

const BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const POLICY = 'e2e';

async function call(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const step = (name, fn) => fn().then(() => console.log(`✓ ${name}`));

const [a, b] = [await newSession(), await newSession()];
// First sight provisions each user row.
await call(a, 'GET', '/user/profile');
await call(b, 'GET', '/user/profile');

try {
  let codeB;

  await step('a code is minted with the first name', async () => {
    assert.equal((await call(a, 'POST', '/circle/requests', { code: 'ABCDEF' })).status, 409, 'no name yet');
    const me = await call(a, 'PUT', '/circle/profile', { name: 'Asha' });
    assert.equal(me.status, 200);
    const other = await call(b, 'PUT', '/circle/profile', { name: 'Ben' });
    codeB = other.body.code;
    assert.match(codeB, /^[A-HJ-NP-Z2-9]{6}$/);
  });

  await step('asking by code, and being asked', async () => {
    assert.equal((await call(a, 'POST', '/circle/requests', { code: 'ZZZZZZ' })).status, 404);
    assert.equal((await call(a, 'POST', '/circle/requests', { code: codeB.toLowerCase() })).status, 201);
    assert.equal((await call(a, 'POST', '/circle/requests', { code: codeB })).status, 409);

    const seenByB = await call(b, 'GET', '/circle');
    assert.deepEqual(seenByB.body.incoming.map(r => r.name), ['Asha']);
    const accept = await call(b, 'POST', `/circle/requests/${seenByB.body.incoming[0].id}/accept`);
    assert.equal(accept.status, 204);
  });

  await step('nothing is shared without the circle consent', async () => {
    const put = await call(b, 'PUT', '/circle/status', { weather: 'fog', date: new Date().toISOString().slice(0, 10) });
    assert.equal(put.status, 403);
  });

  await step('with consent, only the weather and the low signal travel', async () => {
    await call(b, 'PUT', '/user/consents', { consents: { circle: true }, policyVersion: POLICY });
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await call(b, 'PUT', '/circle/status', { weather: 'fog', date: today, note: 'x' })).status, 400);
    assert.equal((await call(b, 'PUT', '/circle/status', { weather: 'fog', date: today, rhythm: [1, 1, 1, -3, 1, 2, 3] })).status, 204);
    assert.equal((await call(b, 'PUT', '/circle/low', { on: true })).status, 204);

    const seenByA = await call(a, 'GET', '/circle');
    assert.equal(seenByA.body.friends.length, 1);
    assert.deepEqual(
      { name: seenByA.body.friends[0].name, weather: seenByA.body.friends[0].weather, low: seenByA.body.friends[0].low },
      { name: 'Ben', weather: 'fog', low: true }
    );
  });

  await step('thinking of you, once an hour', async () => {
    const friendship = (await call(a, 'GET', '/circle')).body.friends[0].id;
    assert.equal((await call(a, 'POST', `/circle/friends/${friendship}/nudge`)).status, 204);
    assert.equal((await call(a, 'POST', `/circle/friends/${friendship}/nudge`)).status, 429);
    assert.equal((await call(a, 'POST', '/circle/friends/not-a-uuid/nudge')).status, 404);

    const seenByB = await call(b, 'GET', '/circle');
    assert.deepEqual(seenByB.body.nudges.map(n => n.name), ['Asha']);
    await call(b, 'POST', '/circle/nudges/seen');
    assert.equal((await call(b, 'GET', '/circle')).body.nudges.length, 0);
  });

  await step('withdrawing consent takes the shared weather down', async () => {
    await call(b, 'PUT', '/user/consents', { consents: { circle: false }, policyVersion: POLICY });
    const friend = (await call(a, 'GET', '/circle')).body.friends[0];
    assert.equal(friend.weather, null);
    assert.equal(friend.low, false);
  });

  await step('either side can leave', async () => {
    const friendship = (await call(b, 'GET', '/circle')).body.friends[0].id;
    assert.equal((await call(b, 'DELETE', `/circle/friends/${friendship}`)).status, 204);
    assert.equal((await call(a, 'GET', '/circle')).body.friends.length, 0);
  });
} finally {
  await call(a, 'DELETE', '/user');
  await call(b, 'DELETE', '/user');
  console.log('✓ both test accounts erased');
}
