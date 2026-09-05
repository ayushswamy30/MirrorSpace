import { supabase, unwrap } from '../config/supabase.js';

const COLUMNS = 'id, user_id, type, content, sentiment, patterns, reflection, reflection_generated_at, created_at';
// The list view deliberately omits sentiment/patterns: that analysis runs
// silently and is never surfaced back to the user.
const LIST_COLUMNS = 'id, type, content, reflection, created_at';

export function toJournalEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    sentiment: row.sentiment ?? {},
    patterns: row.patterns ?? {},
    reflection: row.reflection ?? null,
    reflectionGeneratedAt: row.reflection_generated_at ?? null,
    createdAt: row.created_at
  };
}

export async function create(userId, { type, content, sentiment, patterns }) {
  const row = unwrap(
    await supabase
      .from('journal_entries')
      .insert({ user_id: userId, type, content, sentiment, patterns })
      .select(COLUMNS)
      .single(),
    'journalEntries.create'
  );
  return toJournalEntry(row);
}

export async function listForUser(userId, { limit, offset }) {
  const { data, error, count } = await supabase
    .from('journal_entries')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  unwrap({ data, error }, 'journalEntries.listForUser');

  return {
    entries: data.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      reflection: row.reflection ?? null,
      createdAt: row.created_at
    })),
    total: count ?? 0
  };
}

export async function listSince(userId, since) {
  const rows = unwrap(
    await supabase
      .from('journal_entries')
      .select('id, sentiment, patterns, created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false }),
    'journalEntries.listSince'
  );

  return rows.map(row => ({
    id: row.id,
    sentiment: row.sentiment ?? {},
    patterns: row.patterns ?? {},
    createdAt: row.created_at
  }));
}
