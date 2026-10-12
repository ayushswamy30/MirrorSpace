import { supabase, unwrap } from '../config/supabase.js';

/**
 * Keeps this browser's subscription and replaces what it has waiting. A
 * subscription moves to whoever registered it last, like a phone's token.
 */
export async function save(userId, { endpoint, p256dh, auth }, alerts, schedule) {
  unwrap(
    await supabase
      .from('web_push_subscriptions')
      .upsert({ endpoint, user_id: userId, p256dh, auth, alerts, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' }),
    'webPush.save'
  );
  unwrap(await supabase.from('web_push_schedule').delete().eq('endpoint', endpoint), 'webPush.clearSchedule');
  if (schedule.length > 0) {
    unwrap(
      await supabase.from('web_push_schedule').insert(schedule.map(({ kind, sendAt }) => ({ endpoint, kind, send_at: sendAt }))),
      'webPush.schedule'
    );
  }
}

/** Only the owner can take a subscription off their account. */
export async function remove(userId, endpoint) {
  unwrap(await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId), 'webPush.remove');
}

export async function find(userId, endpoint) {
  const rows = unwrap(
    await supabase.from('web_push_subscriptions').select('endpoint, p256dh, auth').eq('endpoint', endpoint).eq('user_id', userId),
    'webPush.find'
  );
  return rows[0] ?? null;
}

/** Where these people's Circle alerts go: only browsers that kept alerts on. */
export async function subscriptionsFor(userIds) {
  if (userIds.length === 0) return [];
  return unwrap(
    await supabase.from('web_push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds).eq('alerts', true),
    'webPush.subscriptionsFor'
  );
}

/** What is due by now, with where it goes. */
export async function due(now, limit = 500) {
  return unwrap(
    await supabase
      .from('web_push_schedule')
      .select('id, kind, send_at, subscription:web_push_subscriptions (endpoint, p256dh, auth)')
      .lte('send_at', now.toISOString())
      .order('send_at')
      .limit(limit),
    'webPush.due'
  );
}

export async function done(ids) {
  if (ids.length === 0) return;
  unwrap(await supabase.from('web_push_schedule').delete().in('id', ids), 'webPush.done');
}

export async function forget(endpoints) {
  if (endpoints.length === 0) return;
  unwrap(await supabase.from('web_push_subscriptions').delete().in('endpoint', endpoints), 'webPush.forget');
}
