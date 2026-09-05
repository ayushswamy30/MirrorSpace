import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

/**
 * Server-side Supabase client.
 *
 * Uses the service role key, so it bypasses Row Level Security. Every table
 * in the schema has RLS enabled with no permissive policies, which means this
 * client is the only way into the data — and authorisation is therefore the
 * API layer's job. Every repository query filters on user_id explicitly.
 */
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      // No browser session to persist or refresh on a server.
      persistSession: false,
      autoRefreshToken: false
    },
    db: { schema: 'public' }
  }
);

/**
 * Unwrap a PostgREST response, turning the error branch into a thrown Error
 * so callers can use ordinary try/catch instead of checking `error` by hand.
 */
export function unwrap({ data, error }, context) {
  if (error) {
    const err = new Error(`${context}: ${error.message}`);
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
  return data;
}
