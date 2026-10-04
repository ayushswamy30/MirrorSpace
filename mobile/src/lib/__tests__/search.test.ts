import { search, snippet } from '../search';

const mockAll = jest.fn();
jest.mock('../db/database', () => ({ getDatabase: () => Promise.resolve({ getAllAsync: (...a: unknown[]) => mockAll(...a) }) }));

test('a snippet is a window around the match, marked where it was cut', () => {
  const text = 'It was a long day at work and then the bus was late again, which was the last straw for the week.';
  expect(snippet(text, 'bus', 12)).toBe('…then the bus was late…');
  expect(snippet('short', 'missing')).toBe('short');
});

test('search looks in pages, notes and words, newest first, and escapes wildcards', async () => {
  mockAll
    .mockResolvedValueOnce([{ id: 'v1', local_date: '2026-09-30', created_at: '2026-09-30T10:00:00Z', body: 'the bus again' }])
    .mockResolvedValueOnce([{ id: 'c1', local_date: '2026-10-01', created_at: '2026-10-01T10:00:00Z', note: 'missed the bus' }])
    .mockResolvedValueOnce([]);
  const hits = await search('bus');
  expect(hits.map(h => h.kind)).toEqual(['note', 'page']);
  expect(hits[0].localDate).toBe('2026-10-01');

  mockAll.mockResolvedValue([]);
  await search('50%');
  expect(mockAll).toHaveBeenLastCalledWith(expect.stringContaining('ESCAPE'), String.raw`%50\%%`, 40);
});

test('one letter is too little to search', async () => {
  mockAll.mockClear();
  expect(await search('a')).toEqual([]);
  expect(mockAll).not.toHaveBeenCalled();
});
