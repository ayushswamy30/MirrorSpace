// End-to-end API tests. Point them at a running Lowkei server backed by
// a Supabase project you don't mind writing to — every run creates real rows.
//
//   API_BASE_URL=http://localhost:5000/api \
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:e2e
//
// Sessions come from Supabase anonymous sign-in; see ./session.mjs for the
// local-stack alternative.
//
import { newSession } from './session.mjs';

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

console.log('\n== session ==');
const token = await newSession();

const init = await call('GET', '/user/profile', { token });
check('a Supabase session provisions an app user', init.status === 200 && !!init.json.id,
  JSON.stringify(init.json));
const userId = init.json.id;

const reinit = await call('GET', '/user/profile', { token });
check('the same session maps to the same app user', reinit.json.id === userId,
  `${reinit.json.id} vs ${userId}`);
check('new users start anonymous', init.json.isAnonymous === true);

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
check('profile exposes account state', 'email' in profile.json && 'isAnonymous' in profile.json);

console.log('\n== consents ==');
const consent = await call('PUT', '/user/consents', { token, body: { consents: { readings: true }, policyVersion: '2026-10-10' } });
check('PUT /user/consents records a grant', consent.status === 200, JSON.stringify(consent.json));
const withdrawn = await call('PUT', '/user/consents', { token, body: { consents: { readings: false }, policyVersion: '2026-10-10' } });
check('and a withdrawal', withdrawn.status === 200);

console.log('\n== cross-user isolation ==');
const otherToken = await newSession();
const otherProfile = await call('GET', '/user/profile', { token: otherToken });
check('another session is another user', otherProfile.json.id !== userId);

console.log('\n== export my data ==');
const exportRes = await fetch(`${BASE}/user/export`, { headers: { authorization: `Bearer ${token}` } });
const exported = await exportRes.json();
check('GET /user/export succeeds', exportRes.status === 200);
check('offers itself as a download', /attachment; filename=/.test(exportRes.headers.get('content-disposition') || ''),
  String(exportRes.headers.get('content-disposition')));
check('is not cacheable', (exportRes.headers.get('cache-control') || '').includes('no-store'),
  String(exportRes.headers.get('cache-control')));
check('carries every section', ['account', 'consentEvents', 'circle', 'sleepLogs', 'journalEntries', 'insights', 'chatSessions', 'moodPatterns', 'calmTriggers']
  .every(k => k in exported), Object.keys(exported).join(','));
check('includes every consent, in order',
  exported.consentEvents.filter(e => e.purpose === 'readings').map(e => e.granted).join() === 'true,false',
  JSON.stringify(exported.consentEvents));

const otherExport = await (await fetch(`${BASE}/user/export`, { headers: { authorization: `Bearer ${otherToken}` } })).json();
check('another account exports nothing of ours', otherExport.consentEvents.length === 0, JSON.stringify(otherExport.consentEvents));

console.log('\n== delete my account ==');
// A throwaway account, so the assertions above keep their data.
const doomedToken = await newSession();
await call('PUT', '/user/consents', { token: doomedToken, body: { consents: { readings: true }, policyVersion: '2026-10-10' } });
const doomedExport = await (await fetch(`${BASE}/user/export`, { headers: { authorization: `Bearer ${doomedToken}` } })).json();
check('throwaway account has a consent', doomedExport.consentEvents.length === 1);

const del = await call('DELETE', '/user', { token: doomedToken });
check('DELETE /user succeeds', del.status === 200 && del.json.deleted === true, JSON.stringify(del.json));

const afterDelete = await call('GET', '/user/profile', { token: doomedToken });
check('the token no longer authenticates', afterDelete.status === 401, `got ${afterDelete.status}`);
check('the survivor account is untouched', (await call('GET', '/user/profile', { token })).json.id === userId);

console.log('\n== misc ==');
check('unknown route 404s', (await call('GET', '/nope')).status === 404);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
