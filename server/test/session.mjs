// Obtains access tokens for the e2e suites.
//
// Against a real Supabase project, set SUPABASE_URL and SUPABASE_ANON_KEY and
// each call signs in a fresh anonymous user — the same thing the app does on
// first load. (Anonymous sign-ins must be enabled for the project.)
//
// Against the local test stack there is no Auth server, so tokens are minted
// directly from the keypair the shim serves; set KEYS_FILE and PSQL instead.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const useLocalKeys = Boolean(process.env.KEYS_FILE);

async function localToken() {
  const { SignJWT, importPKCS8 } = await import('jose');
  const keys = JSON.parse(readFileSync(process.env.KEYS_FILE, 'utf8'));
  const key = await importPKCS8(keys.privateA, 'ES256');
  const issuer = process.env.TOKEN_ISSUER || 'http://127.0.0.1:4000/auth/v1';

  const sub = randomUUID();
  // Stand in for GoTrue creating the auth.users row on sign-up.
  execFileSync('bash', [
    '-c',
    `${process.env.PSQL} -q -c "insert into auth.users (id, is_anonymous) values ('${sub}', true);"`
  ], { stdio: 'pipe' });

  return new SignJWT({ email: null, is_anonymous: true, role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: keys.kidA })
    .setSubject(sub)
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(key);
}

async function supabaseToken() {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`);
  return data.session.access_token;
}

/** A fresh anonymous session. Call twice to get two distinct users. */
export async function newSession() {
  if (useLocalKeys) return localToken();

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) return supabaseToken();

  throw new Error(
    'Set SUPABASE_URL and SUPABASE_ANON_KEY (real project) or KEYS_FILE and PSQL (local stack)'
  );
}
