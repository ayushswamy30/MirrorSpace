import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment configuration, validated once at boot.
 *
 * Failing here is deliberate: a server that starts with a missing Supabase
 * key only fails later, one request at a time, with a confusing 500.
 */

function required(name, { minLength = 1 } = {}) {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (value.trim().length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters`);
  }

  return value.trim();
}

function optional(name, fallback = null) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) return fallback;

  const trimmed = value.trim();
  // The old .env.example shipped `your_x_key_here` placeholders. Treat those
  // as "not configured" rather than handing them to a provider.
  if (/^your_.*_here$/i.test(trimmed)) return fallback;

  return trimmed;
}

function list(name, fallback = []) {
  const value = optional(name);
  if (!value) return fallback;
  return value.split(',').map(entry => entry.trim()).filter(Boolean);
}

const supabaseUrl = required('SUPABASE_URL').replace(/\/+$/, '');

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  supabase: {
    url: supabaseUrl,
    // The service role key bypasses RLS. It must never reach the browser —
    // it lives only in the API process.
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    // Tokens this API will accept must carry this issuer.
    issuer: `${supabaseUrl}/auth/v1`,
    jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`
  },

  // Sessions are issued by Supabase Auth, not by this server. All we do is
  // verify the access tokens it signs.
  //
  // Projects on asymmetric JWT signing keys (the current default) need
  // nothing here: the public keys come from the project's JWKS endpoint.
  // Projects still on the legacy shared HMAC secret set SUPABASE_JWT_SECRET.
  supabaseJwtSecret: optional('SUPABASE_JWT_SECRET'),

  // Minimum gap between JWKS refetches. This is what bounds how quickly a
  // newly rotated signing key is picked up — and, in the other direction,
  // stops a stream of tokens bearing unknown key ids from turning into a
  // stream of outbound fetches. Supabase publishes a new key as standby
  // before it signs anything with it, so the default is comfortable.
  jwksCooldownMs: Number(optional('SUPABASE_JWKS_COOLDOWN_MS', '30000')),

  corsOrigins: list('CORS_ORIGINS', ['http://localhost:5173']),

  ai: {
    groqApiKey: optional('GROQ_API_KEY'),
    openaiApiKey: optional('OPENAI_API_KEY')
  }
};

export const isProduction = config.nodeEnv === 'production';
