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

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  supabase: {
    url: required('SUPABASE_URL'),
    // The service role key bypasses RLS. It must never reach the browser —
    // it lives only in the API process.
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY')
  },

  // Signs the app's own anonymous session tokens.
  jwtSecret: required('JWT_SECRET', { minLength: 32 }),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '365d'),

  corsOrigins: list('CORS_ORIGINS', ['http://localhost:5173']),

  ai: {
    groqApiKey: optional('GROQ_API_KEY'),
    openaiApiKey: optional('OPENAI_API_KEY')
  }
};

export const isProduction = config.nodeEnv === 'production';
