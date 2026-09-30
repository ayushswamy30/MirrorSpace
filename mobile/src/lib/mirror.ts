import { api, ApiError, NetworkError } from './api';
import { isPreview } from './preview';
import { getDatabase } from './db/database';

/**
 * Mirror chat (report §5, §7). The conversation is kept only in the phone's
 * encrypted database; each turn goes to the server to be answered and is not
 * stored there. Mirror is software, and says so.
 */

export type MirrorMessage = { id: number; role: 'user' | 'mirror'; content: string; createdAt: string };

export type MirrorStatus =
  | { kind: 'open' }
  | { kind: 'no-consent' }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

/** How many recent turns go with each question. */
const TURNS_SENT = 20;

export const SUGGESTIONS = [
  'Why do I feel like this?',
  'What have I been avoiding?',
  'What would help tonight?',
  'What did today take out of me?',
  'Am I being too hard on myself?',
  'What keeps coming back?'
] as const;

/**
 * The reference's Void offers questions by theme, each with a picture. These
 * are MirrorSpace's own: about the person, never about the stars.
 */
export const TOPICS = [
  {
    key: 'self',
    label: 'self',
    art: 'eye',
    questions: ['Why do I feel like this?', 'Am I being too hard on myself?', 'What keeps coming back?', 'What do I need right now?']
  },
  {
    key: 'love',
    label: 'love',
    art: 'heart',
    questions: ['Why does this person stay on my mind?', 'Am I giving more than I get?', 'How do I say what I need?', 'What am I afraid to ask for?']
  },
  {
    key: 'work',
    label: 'work',
    art: 'moka',
    questions: ['What have I been avoiding?', 'Why does this feel so heavy?', 'What would make tomorrow lighter?', 'Am I doing this for me?']
  },
  {
    key: 'rest',
    label: 'rest',
    art: 'swan',
    questions: ['What would help tonight?', 'What did today take out of me?', 'Why can’t I switch off?', 'What does rest look like for me?']
  }
] as const;

export type TopicKey = (typeof TOPICS)[number]['key'];

export async function mirrorStatus(): Promise<MirrorStatus> {
  if (isPreview) return { kind: 'open' };
  try {
    const s = await api.get<{ consented: boolean; available: boolean }>('/mirror/status');
    if (!s.consented) return { kind: 'no-consent' };
    return s.available ? { kind: 'open' } : { kind: 'unavailable' };
  } catch (error) {
    if (error instanceof NetworkError) return { kind: 'offline' };
    throw error;
  }
}

export class MirrorUnavailable extends Error {
  constructor(readonly status: MirrorStatus) {
    super('Mirror is not available');
    this.name = 'MirrorUnavailable';
  }
}

/** Mirror's answer to the conversation so far (which ends on the person's turn). */
export async function askMirror(history: readonly MirrorMessage[]): Promise<string> {
  if (isPreview) return 'This is the browser preview, so nothing was sent anywhere. On the phone, Mirror answers here.';
  const messages = history.slice(-TURNS_SENT).map(m => ({ role: m.role, content: m.content }));
  try {
    const { reply } = await api.post<{ reply: string }>('/mirror/reply', { messages });
    return reply;
  } catch (error) {
    if (error instanceof NetworkError) throw new MirrorUnavailable({ kind: 'offline' });
    if (error instanceof ApiError && error.status === 403) throw new MirrorUnavailable({ kind: 'no-consent' });
    if (error instanceof ApiError && error.status === 503) {
      const code = (error.body as { code?: string } | null)?.code;
      if (code === 'unavailable') throw new MirrorUnavailable({ kind: 'unavailable' });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// The conversation, on the phone

type Row = { id: number; role: 'user' | 'mirror'; content: string; created_at: string };

export async function listMessages(limit = 200): Promise<MirrorMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM (SELECT * FROM mirror_messages ORDER BY id DESC LIMIT ?) ORDER BY id ASC',
    limit
  );
  return rows.map(r => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }));
}

export async function addMessage(role: MirrorMessage['role'], content: string, now: Date = new Date()): Promise<MirrorMessage> {
  const db = await getDatabase();
  const createdAt = now.toISOString();
  const result = await db.runAsync(
    'INSERT INTO mirror_messages (role, content, created_at) VALUES (?, ?, ?)',
    role,
    content,
    createdAt
  );
  return { id: result.lastInsertRowId, role, content, createdAt };
}

export async function clearConversation(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM mirror_messages');
}
