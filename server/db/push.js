import { supabase, unwrap } from '../config/supabase.js';

/** A token moves to whoever registered it last: phones change hands. */
export async function save(userId, { token, platform }) {
  unwrap(
    await supabase
      .from('push_tokens')
      .upsert({ token, user_id: userId, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' }),
    'push.save'
  );
}

/** Only the owner can take a token off their account. */
export async function remove(userId, token) {
  unwrap(await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', userId), 'push.remove');
}

export async function tokensFor(userIds) {
  if (userIds.length === 0) return [];
  const rows = unwrap(await supabase.from('push_tokens').select('token').in('user_id', userIds), 'push.tokensFor');
  return rows.map(r => r.token);
}

export async function forget(tokens) {
  if (tokens.length === 0) return;
  unwrap(await supabase.from('push_tokens').delete().in('token', tokens), 'push.forget');
}
