import { supabase, unwrap } from '../config/supabase.js';

const COLUMNS = 'id, user_id, date, sleep_time, wake_time, duration, created_at';

export function toSleepLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    sleepTime: row.sleep_time,
    wakeTime: row.wake_time,
    duration: row.duration,
    createdAt: row.created_at
  };
}

/**
 * One log per night. Re-submitting the same date corrects the existing row
 * instead of stacking duplicates that would skew every average downstream.
 */
export async function upsert(userId, { date, sleepTime, wakeTime, duration }) {
  const row = unwrap(
    await supabase
      .from('sleep_logs')
      .upsert(
        {
          user_id: userId,
          date,
          sleep_time: sleepTime,
          wake_time: wakeTime,
          duration
        },
        { onConflict: 'user_id,date' }
      )
      .select(COLUMNS)
      .single(),
    'sleepLogs.upsert'
  );
  return toSleepLog(row);
}

/**
 * @param {string} userId
 * @param {Date|null} since  null means "all history"
 * @param {'asc'|'desc'} order
 */
export async function listForUser(userId, since = null, order = 'desc') {
  let query = supabase
    .from('sleep_logs')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('date', { ascending: order === 'asc' });

  if (since) {
    query = query.gte('date', since.toISOString().slice(0, 10));
  }

  const rows = unwrap(await query, 'sleepLogs.listForUser');
  return rows.map(toSleepLog);
}

export async function countForUser(userId, since) {
  const { count } = await supabase
    .from('sleep_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', since.toISOString().slice(0, 10));

  return count ?? 0;
}
