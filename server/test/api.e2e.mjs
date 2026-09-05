// End-to-end API tests. Point them at a running MirrorSpace server backed by
// a Supabase project you don't mind writing to — every run creates real rows.
//
//   API_BASE_URL=http://localhost:5000/api npm run test:e2e
//
// AI keys are optional: with none configured the reflection endpoints fall
// through to their built-in fallbacks, which is exactly what these assertions
// check for (a response exists, of the right shape).
const BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
let pass = 0, fail = 0;

const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const localId = crypto.randomUUID();

console.log('\n== auth ==');
const init = await call('POST', '/auth/init', { body: { localId } });
check('POST /auth/init creates user', init.status === 200 && !!init.json.token, JSON.stringify(init.json));
const token = init.json.token;
const userId = init.json.user.id;

const reinit = await call('POST', '/auth/init', { body: { localId } });
check('POST /auth/init is idempotent on localId', reinit.json.user?.id === userId,
  `${reinit.json.user?.id} vs ${userId}`);

const badId = await call('POST', '/auth/init', { body: { localId: 'not-a-uuid' } });
check('POST /auth/init rejects non-UUID localId', badId.json.user?.localId !== 'not-a-uuid');

check('auth required', (await call('GET', '/user/profile')).status === 401);
check('bad token rejected', (await call('GET', '/user/profile', { token: 'garbage' })).status === 401);

console.log('\n== user ==');
const onboard = await call('PUT', '/user/onboarding', {
  token,
  body: { intents: ['sleep_better', 'reduce_anxiety', 'bogus'], permissions: { sleepTracking: true, journaling: true, nonsense: true } }
});
check('PUT /user/onboarding saves', onboard.status === 200 && onboard.json.onboardingComplete === true, JSON.stringify(onboard.json));
check('invalid intent stripped', !onboard.json.intents?.includes('bogus'), JSON.stringify(onboard.json.intents));
check('unknown permission stripped', onboard.json.permissions?.nonsense === undefined);
check('permissions persisted', onboard.json.permissions?.sleepTracking === true);

const profile = await call('GET', '/user/profile', { token });
check('GET /user/profile round-trips', profile.json.id === userId && profile.json.onboardingComplete === true);

console.log('\n== sleep ==');
const mkNight = (daysAgo, hours) => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(23, 0, 0, 0);
  const wake = new Date(d.getTime() + hours * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), sleepTime: d.toISOString(), wakeTime: wake.toISOString() };
};
const s1 = await call('POST', '/sleep', { token, body: mkNight(1, 8) });
check('POST /sleep creates log', s1.status === 201 && s1.json.duration === 480, JSON.stringify(s1.json));
await call('POST', '/sleep', { token, body: mkNight(2, 5) });
await call('POST', '/sleep', { token, body: mkNight(3, 6.5) });

const dup = await call('POST', '/sleep', { token, body: mkNight(1, 6) });
check('POST /sleep same night updates instead of duplicating', dup.status === 201 && dup.json.duration === 360);

check('POST /sleep rejects wake before sleep', (await call('POST', '/sleep', {
  token, body: { date: '2026-01-01', sleepTime: '2026-01-01T08:00:00Z', wakeTime: '2026-01-01T07:00:00Z' }
})).status === 400);
check('POST /sleep rejects garbage dates', (await call('POST', '/sleep', {
  token, body: { date: 'nope', sleepTime: 'nope', wakeTime: 'nope' }
})).status === 400);

const hist = await call('GET', '/sleep?range=week', { token });
check('GET /sleep?range=week returns array (client contract)', Array.isArray(hist.json) && hist.json.length === 3,
  JSON.stringify(hist.json).slice(0, 200));
check('GET /sleep is ascending by date', Array.isArray(hist.json) &&
  hist.json.every((l, i) => i === 0 || l.date >= hist.json[i - 1].date));
check('GET /sleep rows carry camelCase sleepTime/wakeTime', !!hist.json[0]?.sleepTime && !!hist.json[0]?.wakeTime);
check('GET /sleep rejects unknown range', (await call('GET', '/sleep?range=decade', { token })).status === 400);
check('GET /sleep?range=all works', Array.isArray((await call('GET', '/sleep?range=all', { token })).json));

const trends = await call('GET', '/sleep/trends?days=7', { token });
check('GET /sleep/trends aggregates', trends.json.trends?.totalLogs === 3 && trends.json.trends.sleepDebt === 3,
  JSON.stringify(trends.json.trends));

console.log('\n== journal ==');
const j1 = await call('POST', '/journal', { token, body: { content: 'I am so tired today. Everything feels heavy and slow. Why?', type: 'text' } });
check('POST /journal creates entry', j1.status === 201 && !!j1.json.id, JSON.stringify(j1.json));
check('POST /journal hides analysis from response', j1.json.sentiment === undefined && j1.json.patterns === undefined);
await call('POST', '/journal', { token, body: { content: 'today was good, I felt light and happy', type: 'chaos' } });
check('POST /journal rejects blank', (await call('POST', '/journal', { token, body: { content: '   ' } })).status === 400);
check('POST /journal rejects bad type', (await call('POST', '/journal', { token, body: { content: 'x', type: 'wat' } })).status === 400);
check('POST /journal rejects oversized', (await call('POST', '/journal', { token, body: { content: 'x'.repeat(20001) } })).status === 413);

const jl = await call('GET', '/journal?limit=10&page=1', { token });
check('GET /journal paginates', jl.json.total === 2 && jl.json.entries.length === 2 && jl.json.pages === 1, JSON.stringify(jl.json).slice(0, 200));
check('GET /journal omits sentiment', jl.json.entries[0]?.sentiment === undefined);

console.log('\n== calm ==');
const calm = await call('POST', '/calm/trigger', { token, body: { source: 'panic_detected' } });
check('POST /calm/trigger activates', calm.json.activated === true && calm.json.source === 'panic_detected');
const calmBad = await call('POST', '/calm/trigger', { token, body: { source: '; drop table users' } });
check('POST /calm/trigger sanitises source', calmBad.json.source === 'manual');

console.log('\n== chat ==');
const c1 = await call('POST', '/chat/message', { token, body: { message: 'i feel off but idk why' } });
check('POST /chat/message returns session + response', c1.status === 200 && !!c1.json.sessionId && !!c1.json.response,
  JSON.stringify(c1.json).slice(0, 200));
const sessionId = c1.json.sessionId;
const c2 = await call('POST', '/chat/message', { token, body: { message: 'still here', sessionId } });
check('POST /chat/message continues session', c2.json.sessionId === sessionId);
check('POST /chat/message rejects empty', (await call('POST', '/chat/message', { token, body: { message: '' } })).status === 400);

const histChat = await call('GET', '/chat/history', { token });
check('GET /chat/history returns session', Array.isArray(histChat.json) && histChat.json.length === 1,
  JSON.stringify(histChat.json).slice(0, 150));
check('GET /chat/history holds 4 messages in order', histChat.json[0]?.messages?.length === 4 &&
  histChat.json[0].messages[0].role === 'user' && histChat.json[0].messages[1].role === 'mirror',
  JSON.stringify(histChat.json[0]?.messages?.map(m => m.role)));

console.log('\n== cross-user isolation ==');
const other = await call('POST', '/auth/init', { body: { localId: crypto.randomUUID() } });
const otherToken = other.json.token;
const stolen = await call('POST', '/chat/message', { token: otherToken, body: { message: 'hi', sessionId } });
check("another user's sessionId does not attach to their session", stolen.json.sessionId !== sessionId,
  `${stolen.json.sessionId} vs ${sessionId}`);
check('other user sees no journal entries', (await call('GET', '/journal', { token: otherToken })).json.total === 0);
check('other user sees no sleep logs', (await call('GET', '/sleep?range=all', { token: otherToken })).json.length === 0);

console.log('\n== insights ==');
const today = await call('GET', '/insights/today', { token });
check('GET /insights/today returns an insight', today.status === 200 && !!today.json.headline, JSON.stringify(today.json).slice(0, 150));
check('GET /insights/today marks seen', today.json.seen === true, JSON.stringify(today.json).slice(0, 150));
const today2 = await call('GET', '/insights/today', { token });
check('GET /insights/today reuses the same day insight', today2.json.id === today.json.id);
const weekly = await call('GET', '/insights/weekly', { token });
check('GET /insights/weekly returns an insight', weekly.status === 200 && !!weekly.json.headline);

console.log('\n== patterns ==');
const pred = await call('POST', '/patterns/predict', { token });
check('POST /patterns/predict creates a pattern', pred.status === 200 && !!pred.json.id, JSON.stringify(pred.json).slice(0, 200));
check('prediction shape matches Patterns page', typeof pred.json.patterns?.burnoutIndicators === 'number' &&
  !!pred.json.aiInsight && !!pred.json.dataPoints && !!pred.json.period?.start,
  JSON.stringify(pred.json).slice(0, 250));
check('scores clamped 0-100', [pred.json.patterns.burnoutIndicators, pred.json.patterns.anxietyBuildUp, pred.json.patterns.emotionalDrift]
  .every(v => v >= 0 && v <= 100));
check('dataPoints reflect real rows', pred.json.dataPoints.sleepLogs === 3 && pred.json.dataPoints.journalEntries === 2 &&
  pred.json.dataPoints.chatSessions === 1, JSON.stringify(pred.json.dataPoints));

const plist = await call('GET', '/patterns', { token });
check('GET /patterns lists newest first', Array.isArray(plist.json) && plist.json[0]?.id === pred.json.id);

console.log('\n== misc ==');
check('unknown route 404s', (await call('GET', '/nope')).status === 404);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
