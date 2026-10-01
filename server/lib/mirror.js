/**
 * Mirror chat for the phone. Stateless on purpose: the conversation lives in
 * the phone's encrypted database and arrives here only to be answered — the
 * server keeps none of it, as the AI-reflections consent screen promises.
 */

export const MAX_TURNS = 20;
export const MAX_CHARS = 4000;

export class MirrorValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MirrorValidationError';
  }
}

/**
 * The last turns of a conversation, checked and trimmed: roles are 'user' or
 * 'mirror', it must end on the person's turn, and only the tail is kept.
 */
export function parseTurns(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new MirrorValidationError('messages must be a non-empty list');
  }

  const turns = messages.slice(-MAX_TURNS).map(m => {
    if (!m || (m.role !== 'user' && m.role !== 'mirror')) {
      throw new MirrorValidationError("each message needs a role of 'user' or 'mirror'");
    }
    if (typeof m.content !== 'string' || m.content.trim().length === 0) {
      throw new MirrorValidationError('each message needs some text');
    }
    if (m.content.length > MAX_CHARS) {
      throw new MirrorValidationError('a message is longer than Mirror can hold');
    }
    return { role: m.role, content: m.content.trim() };
  });

  if (turns[turns.length - 1].role !== 'user') {
    throw new MirrorValidationError('the conversation must end with your message');
  }
  return turns;
}

/** A vent page sent for a delayed reflection: one page of text, nothing else. */
export const MAX_PAGE_CHARS = 8000;

export function parsePage(body) {
  const text = body?.text;
  if (typeof text !== 'string' || text.trim().length === 0) throw new MirrorValidationError('text is required');
  if (text.length > MAX_PAGE_CHARS) throw new MirrorValidationError('that page is longer than a reflection can hold');
  return text.trim();
}
