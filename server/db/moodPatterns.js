import { supabase, unwrap } from '../config/supabase.js';

const COLUMNS = 'id, user_id, period_start, period_end, patterns, data_points, ai_insight, created_at';

/**
 * Shaped to match what the Patterns page already renders:
 * period.{start,end}, patterns.*, dataPoints.*, aiInsight.{headline,summary}
 */
export function toMoodPattern(row) {
  if (!row) return null;
  return {
    id: row.id,
    period: { start: row.period_start, end: row.period_end },
    patterns: row.patterns ?? {},
    dataPoints: row.data_points ?? {},
    aiInsight: row.ai_insight ?? {},
    createdAt: row.created_at
  };
}

export async function create(userId, { periodStart, periodEnd, patterns, dataPoints, aiInsight }) {
  const row = unwrap(
    await supabase
      .from('mood_patterns')
      .insert({
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        patterns,
        data_points: dataPoints,
        ai_insight: aiInsight
      })
      .select(COLUMNS)
      .single(),
    'moodPatterns.create'
  );
  return toMoodPattern(row);
}

export async function listForUser(userId, limit = 4) {
  const rows = unwrap(
    await supabase
      .from('mood_patterns')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('period_end', { ascending: false })
      .limit(limit),
    'moodPatterns.listForUser'
  );
  return rows.map(toMoodPattern);
}
