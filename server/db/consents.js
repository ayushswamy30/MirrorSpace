import { supabase, unwrap } from '../config/supabase.js';
import { currentConsents } from '../lib/consent.js';

const COLUMNS = 'id, purpose, granted, policy_version, created_at';

function toEvent(row) {
  return {
    id: row.id,
    purpose: row.purpose,
    granted: row.granted,
    policyVersion: row.policy_version,
    createdAt: row.created_at
  };
}

/** Append consent changes. Never updates or deletes: the log is the record. */
export async function record(userId, changes) {
  if (changes.length === 0) return [];

  const rows = unwrap(
    await supabase
      .from('consent_events')
      .insert(changes.map(c => ({
        user_id: userId,
        purpose: c.purpose,
        granted: c.granted,
        policy_version: c.policyVersion
      })))
      .select(COLUMNS),
    'consents.record'
  );

  return rows.map(toEvent);
}

export async function history(userId) {
  const rows = unwrap(
    await supabase
      .from('consent_events')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    'consents.history'
  );
  return rows.map(toEvent);
}

export async function current(userId) {
  return currentConsents(await history(userId));
}

export async function isGranted(userId, purpose) {
  const state = await current(userId);
  return state[purpose]?.granted === true;
}
