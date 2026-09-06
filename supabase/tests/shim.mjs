// TEST-ONLY stand-in for a Supabase project. Never point production at this.
//
// Presents the URL shapes a real project exposes, in front of a local Postgres
// carrying the migrations:
//
//   /rest/v1/*                      -> proxied to PostgREST
//   /auth/v1/.well-known/jwks.json  -> public half of a real ES256 keypair
//   /auth/v1/signup                 -> anonymous sign-in (a GoTrue subset)
//   /auth/v1/token                  -> refresh
//   /auth/v1/user, /auth/v1/logout
//
// The private half of the keypair is written to a keys file so the test suites
// can sign tokens exactly as Supabase Auth would. See ./README.md for how to
// bring the whole stack up.
//
// Run it with node_modules on the path, e.g. from the server directory:
//   KEYS_OUT=keys.json node ../supabase/tests/shim.mjs
import http from 'node:http';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, exportJWK, exportPKCS8, SignJWT } from 'jose';

const TARGET = { host: '127.0.0.1', port: 3999 };
const KID_A = 'local-key-a';
const KID_B = 'local-key-b'; // second key, to exercise rotation

const a = await generateKeyPair('ES256', { extractable: true });
const b = await generateKeyPair('ES256', { extractable: true });

const pub = async (kp, kid) => ({ ...(await exportJWK(kp.publicKey)), kid, alg: 'ES256', use: 'sig' });
const jwks = { keys: [await pub(a, KID_A), await pub(b, KID_B)] };

fs.writeFileSync(process.env.KEYS_OUT || 'keys.json', JSON.stringify({
  jwks,
  privateA: await exportPKCS8(a.privateKey),
  privateB: await exportPKCS8(b.privateKey),
  kidA: KID_A,
  kidB: KID_B
}, null, 2));

// Only key A is published, so a token signed with B exercises the
// unknown-kid path that key rotation depends on.
let published = { keys: [jwks.keys[0]] };
let jwksFetches = 0;

const PSQL = process.env.PSQL || 'psql -h /var/tmp -p 55432 -U postgres -d mirrorspace';
const ISSUER = 'http://127.0.0.1:4000/auth/v1';

// Minimal stand-in for the GoTrue endpoints supabase-js calls during an
// anonymous session: enough to prove the browser wiring, not a reimplementation.
const sessions = new Map(); // refresh_token -> user

async function mintAccessToken(user) {
  return new SignJWT({ email: user.email, is_anonymous: user.is_anonymous, role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: KID_A })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(a.privateKey);
}

async function sessionFor(user) {
  const refresh_token = randomUUID();
  sessions.set(refresh_token, user);
  return {
    access_token: await mintAccessToken(user),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email || '',
      is_anonymous: user.is_anonymous,
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleAuth(req, res, body) {
  const url = new URL(req.url, 'http://127.0.0.1:4000');

  // signInAnonymously()
  if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
    const user = { id: randomUUID(), email: null, is_anonymous: true };
    execFileSync('bash', ['-c',
      `${PSQL} -q -c "insert into auth.users (id, is_anonymous) values ('${user.id}', true);"`]);
    return json(res, 200, await sessionFor(user));
  }

  if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'refresh_token') {
      const parsed = JSON.parse(body.toString() || '{}');
      const user = sessions.get(parsed.refresh_token);
      if (!user) return json(res, 400, { error: 'invalid_grant', error_description: 'Unknown refresh token' });
      return json(res, 200, await sessionFor(user));
    }
    return json(res, 400, { error: 'unsupported_grant_type' });
  }

  if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const claims = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString() || '{}');
    if (!claims.sub) return json(res, 401, { message: 'invalid claim' });
    return json(res, 200, {
      id: claims.sub, aud: 'authenticated', role: 'authenticated',
      email: claims.email || '', is_anonymous: claims.is_anonymous,
      app_metadata: {}, user_metadata: {}, identities: []
    });
  }

  if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
    res.writeHead(204); return res.end();
  }

  return json(res, 404, { message: `shim: unimplemented auth route ${url.pathname}` });
}

http.createServer((req, res) => {
  // CORS, since the browser calls this cross-origin from the preview server.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS,HEAD');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url.startsWith('/auth/v1/.well-known/jwks.json')) {
    jwksFetches++;
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(published));
  }

  // Test hooks: publish the second key, and read the fetch counter.
  if (req.url === '/__test/rotate') {
    published = jwks;
    res.writeHead(200); return res.end('rotated');
  }
  if (req.url === '/__test/jwks-fetches') {
    res.writeHead(200); return res.end(String(jwksFetches));
  }

  if (req.url.startsWith('/auth/v1/')) {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      handleAuth(req, res, Buffer.concat(chunks)).catch(err => json(res, 500, { message: err.message }));
    });
    return;
  }

  const path = req.url.replace(/^\/rest\/v1/, '') || '/';
  const headers = { ...req.headers, host: `${TARGET.host}:${TARGET.port}` };
  delete headers['content-length'];

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const upstream = http.request(
      { ...TARGET, path, method: req.method, headers: { ...headers, 'content-length': body.length } },
      up => { res.writeHead(up.statusCode, up.headers); up.pipe(res); }
    );
    upstream.on('error', err => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: err.message }));
    });
    upstream.end(body);
  });
}).listen(4000, '127.0.0.1', () => console.log('supabase shim (rest + jwks) on :4000'));
