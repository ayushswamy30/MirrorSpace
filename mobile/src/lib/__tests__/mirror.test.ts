import { api, ApiError, NetworkError } from '../api';
import { askMirror, mirrorStatus, MirrorUnavailable, type MirrorMessage } from '../mirror';

// Not requireActual: the real client pulls in Supabase, whose token refresh
// timer reaches for the native database Jest doesn't have.
jest.mock('../api', () => {
  class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(code: number, message: string, payload: unknown) {
      super(message);
      this.status = code;
      this.body = payload;
    }
  }
  class NetworkError extends Error {}
  return { api: { get: jest.fn(), post: jest.fn() }, ApiError, NetworkError };
});
jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

const msg = (id: number, role: MirrorMessage['role'], content: string): MirrorMessage => ({
  id,
  role,
  content,
  createdAt: '2026-09-30T10:00:00.000Z'
});

beforeEach(() => jest.clearAllMocks());

test('status: consent first, then whether reflections are on at all', async () => {
  jest.mocked(api.get).mockResolvedValueOnce({ consented: false, available: true });
  expect(await mirrorStatus()).toEqual({ kind: 'no-consent' });

  jest.mocked(api.get).mockResolvedValueOnce({ consented: true, available: false });
  expect(await mirrorStatus()).toEqual({ kind: 'unavailable' });

  jest.mocked(api.get).mockResolvedValueOnce({ consented: true, available: true });
  expect(await mirrorStatus()).toEqual({ kind: 'open' });

  jest.mocked(api.get).mockRejectedValueOnce(new NetworkError('down'));
  expect(await mirrorStatus()).toEqual({ kind: 'offline' });
});

test('only the last twenty turns are sent, as role and text', async () => {
  jest.mocked(api.post).mockResolvedValue({ reply: 'I hear you.' });
  const history = Array.from({ length: 25 }, (_, i) => msg(i, i % 2 ? 'mirror' : 'user', `m${i}`));

  expect(await askMirror(history)).toBe('I hear you.');
  const [path, body] = jest.mocked(api.post).mock.calls[0];
  expect(path).toBe('/mirror/reply');
  expect((body as { messages: unknown[] }).messages).toHaveLength(20);
  expect((body as { messages: unknown[] }).messages[0]).toEqual({ role: 'mirror', content: 'm5' });
});

test('refusals become a status the room can show', async () => {
  jest.mocked(api.post).mockRejectedValueOnce(new ApiError(403, 'off', { code: 'no_consent' }));
  await expect(askMirror([msg(1, 'user', 'hi')])).rejects.toEqual(new MirrorUnavailable({ kind: 'no-consent' }));

  jest.mocked(api.post).mockRejectedValueOnce(new ApiError(503, 'off', { code: 'unavailable' }));
  await expect(askMirror([msg(1, 'user', 'hi')])).rejects.toMatchObject({ status: { kind: 'unavailable' } });

  jest.mocked(api.post).mockRejectedValueOnce(new ApiError(503, 'none', { code: 'no_reply' }));
  await expect(askMirror([msg(1, 'user', 'hi')])).rejects.toBeInstanceOf(ApiError);
});
