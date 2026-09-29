import { kv } from '../db/kv';
import { addItem, dialable, emptyPlan, isEmpty, loadPlan, removeItem, savePlan, SECTIONS } from '../safetyPlan';

jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn(), remove: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

test('seven steps, in the order a hard moment needs them', () => {
  expect(SECTIONS.map(s => s.key)).toEqual([
    'warningSigns',
    'coping',
    'distractions',
    'people',
    'professionals',
    'safeSpace',
    'reasons'
  ]);
  expect(SECTIONS.filter(s => s.withPhone).map(s => s.key)).toEqual(['people', 'professionals']);
});

test('adding trims, ignores blanks, and keeps a number only when given', () => {
  let plan = emptyPlan();
  expect(isEmpty(plan)).toBe(true);

  plan = addItem(plan, 'coping', { text: '   ' });
  expect(isEmpty(plan)).toBe(true);

  plan = addItem(plan, 'coping', { text: '  a long shower ' });
  plan = addItem(plan, 'people', { text: 'Asha', phone: ' +91 98 7654 3210 ' });
  plan = addItem(plan, 'people', { text: 'Ravi', phone: '' });
  expect(plan.coping).toEqual([{ text: 'a long shower' }]);
  expect(plan.people).toEqual([{ text: 'Asha', phone: '+91 98 7654 3210' }, { text: 'Ravi' }]);

  plan = removeItem(plan, 'people', 0);
  expect(plan.people).toEqual([{ text: 'Ravi' }]);
});

test('only real numbers are dialled', () => {
  expect(dialable('+91 98-7654 3210')).toBe('+919876543210');
  expect(dialable('14416')).toBe('14416');
  expect(dialable('call mum')).toBeNull();
  expect(dialable(undefined)).toBeNull();
});

test('a saved plan loads back; a damaged one loads as empty', async () => {
  const saved = await savePlan(addItem(emptyPlan(), 'reasons', { text: 'my dog' }), new Date('2026-09-29T20:00:00Z'));
  expect(saved.updatedAt).toBe('2026-09-29T20:00:00.000Z');
  const [, json] = jest.mocked(kv.set).mock.calls[0];

  jest.mocked(kv.get).mockResolvedValueOnce(json);
  expect((await loadPlan()).reasons).toEqual([{ text: 'my dog' }]);

  jest.mocked(kv.get).mockResolvedValueOnce('{not json');
  expect(isEmpty(await loadPlan())).toBe(true);

  jest.mocked(kv.get).mockResolvedValueOnce(null);
  expect(isEmpty(await loadPlan())).toBe(true);
});
