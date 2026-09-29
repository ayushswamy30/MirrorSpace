import { supabase, unwrap } from '../config/supabase.js';

const COLUMNS = 'id, user_id, type, headline, subtext, based_on, date, seen, created_at';

export function toInsight(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    headline: row.headline,
    subtext: row.subtext ?? null,
    basedOn: row.based_on ?? [],
    date: row.date,
    seen: row.seen,
    createdAt: row.created_at
  };
}

export async function findLatestSince(userId, type, since) {
  const row = unwrap(
    await supabase
      .from('insights')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('type', type)
      .gte('date', since.toISOString())
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'insights.findLatestSince'
  );
  return toInsight(row);
}

export async function create(userId, { type, headline, subtext, basedOn }) {
  const row = unwrap(
    await supabase
      .from('insights')
      .insert({
        user_id: userId,
        type,
        headline,
        subtext: subtext ?? null,
        based_on: basedOn ?? [],
        date: new Date().toISOString(),
        seen: false
      })
      .select(COLUMNS)
      .single(),
    'insights.create'
  );
  return toInsight(row);
}

export async function markSeen(id) {
  const row = unwrap(
    await supabase.from('insights').update({ seen: true }).eq('id', id).select(COLUMNS).single(),
    'insights.markSeen'
  );
  return toInsight(row);
}
