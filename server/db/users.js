import { supabase, unwrap } from '../config/supabase.js';

const COLUMNS = 'id, local_id, intents, permissions, onboarding_complete, last_active_at, created_at, updated_at';

const DEFAULT_PERMISSIONS = {
  sleepTracking: false,
  journaling: false,
  chatReflections: false
};

const VALID_INTENTS = [
  'understand_mind',
  'reduce_anxiety',
  'sleep_better',
  'vent_without_judgment'
];

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    localId: row.local_id,
    intents: row.intents ?? [],
    permissions: { ...DEFAULT_PERMISSIONS, ...(row.permissions ?? {}) },
    onboardingComplete: row.onboarding_complete,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Reject anything the app doesn't recognise before it reaches Postgres, so a
 * malformed request comes back as a 400 rather than a constraint violation.
 */
export function sanitizeIntents(intents) {
  if (!Array.isArray(intents)) return [];
  return [...new Set(intents.filter(intent => VALID_INTENTS.includes(intent)))];
}

export function sanitizePermissions(permissions) {
  const input = permissions && typeof permissions === 'object' ? permissions : {};
  return {
    sleepTracking: Boolean(input.sleepTracking),
    journaling: Boolean(input.journaling),
    chatReflections: Boolean(input.chatReflections)
  };
}

/**
 * Upsert on local_id: the same anonymous device always lands on the same row,
 * and two concurrent inits race safely instead of creating a duplicate.
 */
export async function findOrCreateByLocalId(localId) {
  const inserted = unwrap(
    await supabase
      .from('users')
      .upsert({ local_id: localId }, { onConflict: 'local_id', ignoreDuplicates: true })
      .select(COLUMNS)
      .maybeSingle(),
    'users.findOrCreateByLocalId'
  );

  if (inserted) return toUser(inserted);

  // ignoreDuplicates returns no row when the user already existed.
  const existing = await findByLocalId(localId);

  if (!existing) {
    throw new Error(`users.findOrCreateByLocalId: no row for local_id after upsert`);
  }

  return existing;
}

export async function findByLocalId(localId) {
  const row = unwrap(
    await supabase.from('users').select(COLUMNS).eq('local_id', localId).maybeSingle(),
    'users.findByLocalId'
  );
  return toUser(row);
}

export async function findById(id) {
  const row = unwrap(
    await supabase.from('users').select(COLUMNS).eq('id', id).maybeSingle(),
    'users.findById'
  );
  return toUser(row);
}

export async function saveOnboarding(id, { intents, permissions }) {
  const row = unwrap(
    await supabase
      .from('users')
      .update({
        intents: sanitizeIntents(intents),
        permissions: sanitizePermissions(permissions),
        onboarding_complete: true
      })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle(),
    'users.saveOnboarding'
  );
  return toUser(row);
}

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

/**
 * The old Mongoose middleware wrote last_active_at on every authenticated
 * request. Throttling it to once per five minutes keeps the signal without
 * putting a write in front of every read.
 */
export async function touchLastActive(user) {
  const last = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (Date.now() - last < ACTIVITY_THROTTLE_MS) return;

  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);
}
