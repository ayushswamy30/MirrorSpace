import { kv } from '../db/kv';
import { citations, memoryForMirror, patternsFrom, setPatternHidden } from '../memory';
import { drawMindChart } from '../mindChart';

jest.mock('../db/database', () => ({ getDatabase: jest.fn(async () => ({ getAllAsync: async () => [{ id: 'x', created_at: 'a', updated_at: 'a', body: 'I work nights' }] })) }));
const mockStore = new Map<string, string>();
jest.mock('../db/kv', () => ({
  kv: {
    get: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => void mockStore.set(k, v))
  }
}));
jest.mock('../checkIns', () => ({ ...jest.requireActual('../checkIns'), allCheckIns: async () => [] }));
jest.mock('../sleep', () => ({ ...jest.requireActual('../sleep'), allSleep: async () => [] }));
jest.mock('../mindChart', () => ({ ...jest.requireActual('../mindChart'), currentMindChart: async () => null }));

beforeEach(() => mockStore.clear());

test('citations come out of the text and point at the items, in order, once each', () => {
  const items = [{ id: 'p1', text: 'Nights run late.' }, { id: 'n1', text: 'I work nights' }];
  expect(citations('Late nights again [p1]. That fits your shifts [n1]. Late [p1].', items)).toEqual({
    text: 'Late nights again. That fits your shifts. Late.',
    sources: [items[0], items[1]]
  });
  // A tag that matches nothing sent is dropped, not invented.
  expect(citations('Hmm [p9].', items)).toEqual({ text: 'Hmm.', sources: [] });
  expect(citations('Plain.', null)).toEqual({ text: 'Plain.', sources: [] });
});

test('the Mind Chart’s placements and leans become patterns', () => {
  const chart = { ...drawMindChart([], [], new Date()), restorers: [{ tag: 'outside', gap: 2, count: 4 }] };
  chart.rhythm = { value: 'Night owl', line: 'Your nights run late.', receipt: 'midpoint 05:00' };
  const keys = patternsFrom([{ key: 'days', text: 'x', receipt: 'y' }], chart).map(p => p.key);
  expect(keys).toEqual(['days', 'mind-rhythm', 'restores-outside']);
});

test('nothing goes to the Mirror until switched on; then notes, and hidden patterns stay back', async () => {
  expect(await memoryForMirror(true)).toBeNull();
  await kv.set('mirror.memory.on', '1');
  expect(await memoryForMirror(false)).toEqual([{ id: 'n1', text: 'I work nights' }]);
  await setPatternHidden('days', true);
  expect(JSON.parse(mockStore.get('mirror.memory.hidden')!)).toEqual(['days']);
});
