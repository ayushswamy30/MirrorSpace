import { supabase, unwrap } from '../config/supabase.js';

const VALID_SOURCES = ['manual', 'panic_detected', 'behavior_spike'];

export function sanitizeSource(source) {
  return VALID_SOURCES.includes(source) ? source : 'manual';
}

export async function record(userId, source) {
  const row = unwrap(
    await supabase
      .from('calm_triggers')
      .insert({ user_id: userId, source: sanitizeSource(source) })
      .select('id, source, created_at')
      .single(),
    'calmTriggers.record'
  );

  return { id: row.id, source: row.source, createdAt: row.created_at };
}

export async function countSince(userId, since) {
  const { count } = await supabase
    .from('calm_triggers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  return count ?? 0;
}
