import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';
import { config } from './env.js';
import { AuthError } from '../lib/errors.js';

/**
 * Verification of Supabase Auth access tokens.
 *
 * Supabase signs project JWTs one of two ways:
 *   - asymmetric (the current default) — ES256/RS256/EdDSA, with the public
 *     keys published at the project's JWKS endpoint;
 *   - the legacy shared HMAC secret — HS256.
 *
 * Both are supported. Verification happens locally either way, so an
 * authenticated request costs no round trip to the Auth server.
 */

// createRemoteJWKSet caches the key set in memory and refetches when it sees a
// `kid` it doesn't know, which is what makes zero-downtime key rotation work.
const jwks = createRemoteJWKSet(new URL(config.supabase.jwksUrl), {
  cooldownDuration: config.jwksCooldownMs,
  cacheMaxAge: 10 * 60_000
});

const hmacKey = config.supabaseJwtSecret
  ? new TextEncoder().encode(config.supabaseJwtSecret)
  : null;

const VERIFY_OPTIONS = {
  issuer: config.supabase.issuer,
  audience: 'authenticated'
};

/**
 * @returns {Promise<{ authUserId: string, email: string|null, isAnonymous: boolean }>}
 * @throws {AuthError} on any token that is missing, malformed, expired, signed
 *   with the wrong key, or issued by a different project.
 */
export async function verifyAccessToken(token) {
  if (!token) throw new AuthError('No token provided');

  let header;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw new AuthError('Malformed token');
  }

  // Route by algorithm rather than trying both: an HS256 token must never be
  // checked against a public key, and vice versa.
  const symmetric = typeof header.alg === 'string' && header.alg.startsWith('HS');

  if (symmetric && !hmacKey) {
    throw new AuthError('Token is HMAC-signed but SUPABASE_JWT_SECRET is not configured');
  }

  let payload;
  try {
    ({ payload } = symmetric
      ? await jwtVerify(token, hmacKey, { ...VERIFY_OPTIONS, algorithms: ['HS256'] })
      : await jwtVerify(token, jwks, VERIFY_OPTIONS));
  } catch (error) {
    throw new AuthError(`Token rejected: ${error.code || error.message}`);
  }

  if (!payload.sub) throw new AuthError('Token has no subject');

  // `role` is what Postgres would SET ROLE to. Anything other than an ordinary
  // end user — service_role above all — must not act as one here.
  if (payload.role !== 'authenticated') {
    throw new AuthError(`Unexpected token role: ${payload.role}`);
  }

  return {
    authUserId: payload.sub,
    email: typeof payload.email === 'string' && payload.email.length > 0 ? payload.email : null,
    // Absent on older tokens; treat an unknown state as anonymous, which is
    // the less privileged of the two.
    isAnonymous: payload.is_anonymous !== false
  };
}
