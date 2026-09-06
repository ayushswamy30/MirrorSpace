import { supabase, unwrap } from '../config/supabase.js';

/**
 * Everything the account holds, for the export endpoint.
 *
 * This deliberately returns the raw content — full journal text, whole
 * conversations, and the sentiment analysis the app never shows in the UI.
 * An export that hid the analysis would be a worse answer to "what do you
 * know about me" than saying nothing.
 */
export async function collectAllData(userId) {
  const [sleep, journals, insights, sessions, patterns, calm] = await Promise.all([
    supabase.from('sleep_logs')
      .select('id, date, sleep_time, wake_time, duration, created_at')
      .eq('user_id', userId).order('date', { ascending: true }),
    supabase.from('journal_entries')
      .select('id, type, content, sentiment, patterns, reflection, reflection_generated_at, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('insights')
      .select('id, type, headline, subtext, based_on, date, seen, created_at')
      .eq('user_id', userId).order('date', { ascending: true }),
    supabase.from('chat_sessions')
      .select('id, context, session_ended_at, created_at, chat_messages(role, content, created_at)')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('mood_patterns')
      .select('id, period_start, period_end, patterns, data_points, ai_insight, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('calm_triggers')
      .select('id, source, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true })
  ]);

  return {
    sleepLogs: unwrap(sleep, 'export.sleepLogs'),
    journalEntries: unwrap(journals, 'export.journalEntries'),
    insights: unwrap(insights, 'export.insights'),
    chatSessions: unwrap(sessions, 'export.chatSessions').map(session => ({
      id: session.id,
      context: session.context,
      createdAt: session.created_at,
      endedAt: session.session_ended_at,
      messages: (session.chat_messages ?? [])
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(m => ({ role: m.role, content: m.content, at: m.created_at }))
    })),
    moodPatterns: unwrap(patterns, 'export.moodPatterns'),
    calmTriggers: unwrap(calm, 'export.calmTriggers')
  };
}

/**
 * Erase the account.
 *
 * Deleting the Supabase Auth identity is what does the work: public.users has
 * a cascading foreign key to auth.users, and every other table cascades from
 * public.users. One delete, nothing orphaned, nothing left to sweep up later.
 */
export async function eraseAccount(authUserId) {
  const { error } = await supabase.auth.admin.deleteUser(authUserId);
  if (error) throw new Error(`account.erase: ${error.message}`);
}
