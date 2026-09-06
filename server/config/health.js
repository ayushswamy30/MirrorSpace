import { supabase } from './supabase.js';

/**
 * Cheapest possible round trip to Postgres: a HEAD count against users.
 * Used by the boot log and the /api/health endpoint so a bad Supabase URL or
 * a schema that was never migrated shows up immediately rather than on the
 * first real request.
 */
export async function verifyConnection() {
  try {
    const { error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
