import { supabase, unwrap } from '../config/supabase.js';

const SESSION_COLUMNS = 'id, user_id, context, session_ended_at, created_at';
const MESSAGE_COLUMNS = 'id, session_id, role, content, created_at';

function toMessage(row) {
  return {
    role: row.role,
    content: row.content,
    timestamp: row.created_at
  };
}

export async function createSession(userId, context) {
  const row = unwrap(
    await supabase
      .from('chat_sessions')
      .insert({ user_id: userId, context })
      .select(SESSION_COLUMNS)
      .single(),
    'chat.createSession'
  );

  return { id: row.id, context: row.context ?? {}, messages: [], createdAt: row.created_at };
}

/**
 * Scoped by user_id as well as id — an id alone is a bearer token for someone
 * else's conversation otherwise.
 */
export async function findSession(sessionId, userId) {
  const session = unwrap(
    await supabase
      .from('chat_sessions')
      .select(SESSION_COLUMNS)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle(),
    'chat.findSession'
  );

  if (!session) return null;

  const messages = unwrap(
    await supabase
      .from('chat_messages')
      .select(MESSAGE_COLUMNS)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
    'chat.findSessionMessages'
  );

  return {
    id: session.id,
    context: session.context ?? {},
    messages: messages.map(toMessage),
    createdAt: session.created_at
  };
}

/**
 * Appending is a plain insert now. Under Mongo this rewrote the whole message
 * array, so two concurrent sends could silently drop one of them.
 */
export async function appendMessages(sessionId, messages) {
  const rows = unwrap(
    await supabase
      .from('chat_messages')
      .insert(messages.map(m => ({ session_id: sessionId, role: m.role, content: m.content })))
      .select(MESSAGE_COLUMNS),
    'chat.appendMessages'
  );

  return rows.map(toMessage);
}

export async function listHistory(userId, limit = 10) {
  const sessions = unwrap(
    await supabase
      .from('chat_sessions')
      .select(`${SESSION_COLUMNS}, chat_messages(role, content, created_at)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'chat.listHistory'
  );

  return sessions.map(session => ({
    id: session.id,
    createdAt: session.created_at,
    messages: (session.chat_messages ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(toMessage)
  }));
}

export async function countSessionsSince(userId, since) {
  const { count } = await supabase
    .from('chat_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  return count ?? 0;
}
