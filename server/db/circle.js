import { supabase, unwrap } from '../config/supabase.js';
import { generateCode } from '../lib/circle.js';

/**
 * Circle storage. Like every repository here it runs with the service role,
 * so each query names the person it is for; the route decides who may ask.
 */

const UNIQUE_VIOLATION = '23505';

export async function me(userId) {
  const row = unwrap(
    await supabase.from('users').select('circle_name, circle_code').eq('id', userId).single(),
    'circle.me'
  );
  return { name: row.circle_name, code: row.circle_code };
}

/** Sets the name friends see, and hands out a code the first time. */
export async function setName(userId, name) {
  const current = await me(userId);
  if (current.code) {
    unwrap(await supabase.from('users').update({ circle_name: name }).eq('id', userId), 'circle.setName');
    return { name, code: current.code };
  }

  // Codes are random; on the rare collision, draw again.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from('users').update({ circle_name: name, circle_code: code }).eq('id', userId);
    if (!error) return { name, code };
    if (error.code !== UNIQUE_VIOLATION) unwrap({ error }, 'circle.setName');
  }
  throw new Error('circle.setName: could not find a free code');
}

export async function findByCode(code) {
  const { data, error } = await supabase
    .from('users')
    .select('id, circle_name')
    .eq('circle_code', code)
    .maybeSingle();
  unwrap({ data, error }, 'circle.findByCode');
  return data ? { id: data.id, name: data.circle_name } : null;
}

export async function friendships(userId) {
  return unwrap(
    await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at, accepted_at')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: true }),
    'circle.friendships'
  );
}

export async function names(userIds) {
  if (userIds.length === 0) return new Map();
  const rows = unwrap(
    await supabase.from('users').select('id, circle_name').in('id', userIds),
    'circle.names'
  );
  return new Map(rows.map(r => [r.id, r.circle_name]));
}

export async function statuses(userIds) {
  if (userIds.length === 0) return new Map();
  const rows = unwrap(
    await supabase.from('circle_status').select('user_id, weather, weather_date, low_since, rhythm').in('user_id', userIds),
    'circle.statuses'
  );
  return new Map(rows.map(r => [r.user_id, r]));
}

/** 'created', or 'exists' when the pair already has a row either way round. */
export async function request(fromId, toId) {
  const { error } = await supabase.from('friendships').insert({ requester_id: fromId, addressee_id: toId });
  if (!error) return 'created';
  if (error.code === UNIQUE_VIOLATION) return 'exists';
  unwrap({ error }, 'circle.request');
}

/** Only the person asked can accept. Returns whether anything changed. */
export async function accept(friendshipId, userId) {
  const rows = unwrap(
    await supabase
      .from('friendships')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', friendshipId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .select('id'),
    'circle.accept'
  );
  return rows.length > 0;
}

/** Declining, cancelling and removing are the same thing: the row goes. */
export async function remove(friendshipId, userId) {
  const rows = unwrap(
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .select('id'),
    'circle.remove'
  );
  return rows.length > 0;
}

export async function saveStatus(userId, { weather, weatherDate, rhythm }) {
  unwrap(
    await supabase.from('circle_status').upsert(
      { user_id: userId, weather, weather_date: weatherDate, rhythm, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ),
    'circle.saveStatus'
  );
}

export async function setLow(userId, on) {
  unwrap(
    await supabase.from('circle_status').upsert(
      { user_id: userId, low_since: on ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ),
    'circle.setLow'
  );
}

/** Withdrawing the circle consent takes everything shared down with it. */
export async function clearStatus(userId) {
  unwrap(await supabase.from('circle_status').delete().eq('user_id', userId), 'circle.clearStatus');
}

export async function lastNudge(fromId, toId) {
  const { data, error } = await supabase
    .from('circle_nudges')
    .select('created_at')
    .eq('from_user_id', fromId)
    .eq('to_user_id', toId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  unwrap({ data, error }, 'circle.lastNudge');
  return data?.created_at ?? null;
}

export async function nudge(fromId, toId) {
  unwrap(await supabase.from('circle_nudges').insert({ from_user_id: fromId, to_user_id: toId }), 'circle.nudge');
}

export async function unseenNudges(userId) {
  return unwrap(
    await supabase
      .from('circle_nudges')
      .select('id, from_user_id, created_at')
      .eq('to_user_id', userId)
      .is('seen_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    'circle.unseenNudges'
  );
}

export async function markNudgesSeen(userId) {
  unwrap(
    await supabase
      .from('circle_nudges')
      .update({ seen_at: new Date().toISOString() })
      .eq('to_user_id', userId)
      .is('seen_at', null),
    'circle.markNudgesSeen'
  );
}
