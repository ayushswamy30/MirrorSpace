import { supabase, unwrap } from '../config/supabase.js';
import { AuthError } from '../lib/errors.js';

const COLUMNS = 'id, local_id, auth_user_id, email, is_anonymous, intents, permissions, onboarding_complete, last_active_at, created_at, updated_at';

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

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    localId: row.local_id,
    authUserId: row.auth_user_id,
    email: row.email,
    isAnonymous: row.is_anonymous,
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
function sanitizeIntents(intents) {
  if (!Array.isArray(intents)) return [];
  return [...new Set(intents.filter(intent => VALID_INTENTS.includes(intent)))];
}

function sanitizePermissions(permissions) {
  const input = permissions && typeof permissions === 'object' ? permissions : {};
  return {
    sleepTracking: Boolean(input.sleepTracking),
    journaling: Boolean(input.journaling),
    chatReflections: Boolean(input.chatReflections)
  };
}

/**
 * Map a Supabase Auth identity to this app's user row, creating it on first
 * sight. Upserting on auth_user_id makes two concurrent first requests race
 * safely instead of producing a duplicate account.
 *
 * `email` and `isAnonymous` are mirrored from the token so the app can show
 * account state without a round trip to the Auth server. They change exactly
 * once in a user's life — when an anonymous account is upgraded — so they are
 * only written when they actually differ.
 */
export async function findOrProvisionByAuthUser({ authUserId, email, isAnonymous }) {
  const existing = unwrap(
    await supabase.from('users').select(COLUMNS).eq('auth_user_id', authUserId).maybeSingle(),
    'users.findOrProvisionByAuthUser'
  );

  if (existing) {
    if (existing.email === email && existing.is_anonymous === isAnonymous) {
      return toUser(existing);
    }

    // The anonymous account just became a permanent one.
    const updated = unwrap(
      await supabase
        .from('users')
        .update({ email, is_anonymous: isAnonymous })
        .eq('auth_user_id', authUserId)
        .select(COLUMNS)
        .single(),
      'users.syncIdentity'
    );
    return toUser(updated);
  }

  const insert = await supabase
    .from('users')
    .upsert(
      { auth_user_id: authUserId, email, is_anonymous: isAnonymous },
      { onConflict: 'auth_user_id', ignoreDuplicates: true }
    )
    .select(COLUMNS)
    .maybeSingle();

  // 23503 is a foreign key violation: the token verifies, but the auth.users
  // row it points at is gone — the account was deleted while this token was
  // still in someone's browser. That is an expired identity, not a fault.
  if (insert.error?.code === '23503') {
    throw new AuthError('Auth identity no longer exists');
  }

  const created = unwrap(insert, 'users.provision');

  if (created) return toUser(created);

  // Lost the race with a concurrent first request; the row exists now.
  const raced = unwrap(
    await supabase.from('users').select(COLUMNS).eq('auth_user_id', authUserId).maybeSingle(),
    'users.provisionRace'
  );

  if (!raced) throw new Error('users.findOrProvisionByAuthUser: no row after upsert');

  return toUser(raced);
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
