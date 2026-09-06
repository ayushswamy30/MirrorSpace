// End-to-end tests for Supabase Auth verification, provisioning and isolation.
//
// Unlike api.e2e.mjs these need to mint tokens, so they run against the local
// test stack rather than a real project: a Postgres carrying the migrations,
// PostgREST in front of it, and a JWKS endpoint holding a real ES256 keypair.
// See supabase/tests/README.md for how that stack is brought up.
//
//   API_BASE_URL=... KEYS_FILE=... PSQL="psql -d mirrorspace" node test/auth.e2e.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SignJWT, importPKCS8 } from 'jose';
import { randomUUID } from 'node:crypto';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:5055/api';
const ISSUER = process.env.TOKEN_ISSUER || 'http://127.0.0.1:4000/auth/v1';
const SHIM = process.env.SHIM_URL || 'http://127.0.0.1:4000';
const keys = JSON.parse(readFileSync(process.env.KEYS_FILE, 'utf8'));

const privA = await importPKCS8(keys.privateA, 'ES256');
const privB = await importPKCS8(keys.privateB, 'ES256');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

/** Stand in for GoTrue creating the auth.users row on sign-up. */
function createAuthUser({ email = null, isAnonymous = true } = {}) {
  const id = randomUUID();
  const sql = `insert into auth.users (id, email, is_anonymous) values ('${id}', ${
    email ? `'${email}'` : 'null'
  }, ${isAnonymous});`;
  execFileSync('bash', ['-c', `${process.env.PSQL} -q -c "${sql}"`], { stdio: 'pipe' });
  return id;
}

async function mint({
  sub, email = null, isAnonymous = true, key = privA, kid = keys.kidA,
  issuer = ISSUER, audience = 'authenticated', role = 'authenticated',
  expiresIn = '1h', notBefore = undefined
} = {}) {
  let jwt = new SignJWT({ email, is_anonymous: isAnonymous, role })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setSubject(sub)
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresIn);
  if (notBefore) jwt = jwt.setNotBefore(notBefore);
  return jwt.sign(key);
}

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
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

console.log('\n== token rejection ==');
const goodSub = createAuthUser();

check('no token', (await call('GET', '/user/profile')).status === 401);
check('garbage token', (await call('GET', '/user/profile', { token: 'not.a.jwt' })).status === 401);
check('unsigned "alg: none"', (await call('GET', '/user/profile', {
  token: `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${
    Buffer.from(JSON.stringify({ sub: goodSub, role: 'authenticated' })).toString('base64url')}.`
})).status === 401);

const forged = await new SignJWT({ role: 'authenticated' })
  .setProtectedHeader({ alg: 'ES256', kid: keys.kidA })
  .setSubject(goodSub).setIssuedAt().setIssuer(ISSUER).setAudience('authenticated')
  .setExpirationTime('1h').sign(privB); // signed with the WRONG key for this kid
check('valid shape, wrong signing key', (await call('GET', '/user/profile', { token: forged })).status === 401);

check('expired token', (await call('GET', '/user/profile', {
  token: await mint({ sub: goodSub, expiresIn: '-5m' })
})).status === 401);
check('not-yet-valid token', (await call('GET', '/user/profile', {
  token: await mint({ sub: goodSub, notBefore: '10m' })
})).status === 401);
check('wrong issuer (another Supabase project)', (await call('GET', '/user/profile', {
  token: await mint({ sub: goodSub, issuer: 'https://evil.supabase.co/auth/v1' })
})).status === 401);
check('wrong audience', (await call('GET', '/user/profile', {
  token: await mint({ sub: goodSub, audience: 'anon' })
})).status === 401);
check('service_role token is not an end user', (await call('GET', '/user/profile', {
  token: await mint({ sub: goodSub, role: 'service_role' })
})).status === 401);
check('anon role token rejected', (await call('GET', '/user/profile', {
  token: await mint({ sub: goodSub, role: 'anon' })
})).status === 401);

console.log('\n== anonymous session ==');
const anonSub = createAuthUser({ isAnonymous: true });
const anonToken = await mint({ sub: anonSub, isAnonymous: true });

const provisioned = await call('GET', '/user/profile', { token: anonToken });
check('first request provisions an app user', provisioned.status === 200 && !!provisioned.json.id,
  JSON.stringify(provisioned.json));
check('provisioned user is marked anonymous', provisioned.json.isAnonymous === true);
check('provisioned user has no email', provisioned.json.email === null);
check('onboarding starts incomplete', provisioned.json.onboardingComplete === false);

const again = await call('GET', '/user/profile', { token: anonToken });
check('second request reuses the same app user', again.json.id === provisioned.json.id,
  `${again.json.id} vs ${provisioned.json.id}`);

console.log('\n== anonymous users can use every feature ==');
check('journal', (await call('POST', '/journal', { token: anonToken, body: { content: 'anonymous entry' } })).status === 201);
const night = new Date(); night.setHours(23, 0, 0, 0);
check('sleep', (await call('POST', '/sleep', {
  token: anonToken,
  body: {
    date: night.toISOString().slice(0, 10),
    sleepTime: night.toISOString(),
    wakeTime: new Date(night.getTime() + 8 * 3600e3).toISOString()
  }
})).status === 201);
check('chat', (await call('POST', '/chat/message', { token: anonToken, body: { message: 'hello' } })).status === 200);
check('calm', (await call('POST', '/calm/trigger', { token: anonToken, body: {} })).status === 200);
check('insights', (await call('GET', '/insights/today', { token: anonToken })).status === 200);

console.log('\n== upgrading anonymous -> permanent ==');
// Supabase keeps the same auth.users.id through the upgrade; only the claims
// change. The app row, and therefore all of the data, must survive.
const upgraded = await mint({ sub: anonSub, email: 'someone@example.com', isAnonymous: false });
const afterUpgrade = await call('GET', '/user/profile', { token: upgraded });
check('same app user after upgrade', afterUpgrade.json.id === provisioned.json.id,
  `${afterUpgrade.json.id} vs ${provisioned.json.id}`);
check('email now recorded', afterUpgrade.json.email === 'someone@example.com', JSON.stringify(afterUpgrade.json));
check('no longer anonymous', afterUpgrade.json.isAnonymous === false);
check('journal entries survived the upgrade',
  (await call('GET', '/journal', { token: upgraded })).json.total === 1);
check('sleep logs survived the upgrade',
  (await call('GET', '/sleep?range=all', { token: upgraded })).json.length === 1);

console.log('\n== isolation between auth identities ==');
const otherSub = createAuthUser({ email: 'other@example.com', isAnonymous: false });
const otherToken = await mint({ sub: otherSub, email: 'other@example.com', isAnonymous: false });
const otherProfile = await call('GET', '/user/profile', { token: otherToken });
check('a different auth user gets a different app user', otherProfile.json.id !== provisioned.json.id);
check('sees none of the first user\'s journals',
  (await call('GET', '/journal', { token: otherToken })).json.total === 0);
check('sees none of the first user\'s sleep logs',
  (await call('GET', '/sleep?range=all', { token: otherToken })).json.length === 0);

// A token whose sub has no auth.users row must not be able to create one:
// the foreign key is the last line of defence if a token is ever forged.
const ghost = await mint({ sub: randomUUID() });
const ghostRes = await call('GET', '/user/profile', { token: ghost });
check('token for a non-existent auth user cannot provision', ghostRes.status >= 400,
  `got ${ghostRes.status} ${JSON.stringify(ghostRes.json)}`);

console.log('\n== JWKS key rotation ==');
// Key B exists in the keypair but is not published yet.
const beforeRotation = await call('GET', '/user/profile', {
  token: await mint({ sub: otherSub, key: privB, kid: keys.kidB, email: 'other@example.com', isAnonymous: false })
});
check('token signed by an unpublished key is rejected', beforeRotation.status === 401);

await fetch(`${SHIM}/__test/rotate`); // project rotates: key B is now published

// The JWKS is not refetched more often than the cooldown, so an unknown key
// id is not picked up instantly by design. Run the server with
// SUPABASE_JWKS_COOLDOWN_MS set low for this test.
const cooldownMs = Number(process.env.SUPABASE_JWKS_COOLDOWN_MS || 30000);
await new Promise(r => setTimeout(r, cooldownMs + 250));

const afterRotation = await call('GET', '/user/profile', {
  token: await mint({ sub: otherSub, key: privB, kid: keys.kidB, email: 'other@example.com', isAnonymous: false })
});
check('same token accepted once the new key is published and cooldown elapses',
  afterRotation.status === 200, `got ${afterRotation.status} ${JSON.stringify(afterRotation.json)}`);
check('the old key still works during rotation', (await call('GET', '/user/profile', {
  token: await mint({ sub: otherSub, key: privA, kid: keys.kidA, email: 'other@example.com', isAnonymous: false })
})).status === 200);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
