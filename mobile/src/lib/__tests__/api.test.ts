import { api, ApiError, NetworkError } from '../api';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: { access_token: 'token-123' } }, error: null }))
    }
  }
}));

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body))
  });
}

beforeEach(() => fetchMock.mockReset());

test('sends the access token and JSON body to the API', async () => {
  respond(200, { ok: true });

  await api.post('/journal', { content: 'hello' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.test/api/journal');
  expect(init.method).toBe('POST');
  expect(init.headers.Authorization).toBe('Bearer token-123');
  expect(init.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(init.body)).toEqual({ content: 'hello' });
});

test('GET sends no body', async () => {
  respond(200, { id: 'u1' });

  await expect(api.get('/user/profile')).resolves.toEqual({ id: 'u1' });
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
});

test('turns an error response into ApiError with the server’s message', async () => {
  respond(413, { message: 'That entry is longer than we can hold' });

  const error = (await api.post('/journal', {}).catch(e => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(413);
  expect(error.message).toBe('That entry is longer than we can hold');
});

test('a request that never arrives is a NetworkError, not an ApiError', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

  await expect(api.get('/user/profile')).rejects.toBeInstanceOf(NetworkError);
});
