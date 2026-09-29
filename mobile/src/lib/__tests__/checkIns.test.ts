import { CONTEXT_TAGS, localDate, suggestTags } from '../checkIns';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));

const defaults = CONTEXT_TAGS.map(t => t.key);

test('with no history, tags keep their usual order', () => {
  expect(suggestTags([])).toEqual(defaults);
});

test('tags this person uses come first, most-used leading, and none go missing', () => {
  const order = suggestTags([['work', 'sleep'], ['sleep'], ['sleep', 'alone'], ['work']]);

  expect(order.slice(0, 3)).toEqual(['sleep', 'work', 'alone']);
  expect([...order].sort()).toEqual([...defaults].sort());
});

test('local date is the calendar day on the device, not in UTC', () => {
  // 23:30 local on 1 March is still 1 March, whatever UTC says.
  expect(localDate(new Date(2026, 2, 1, 23, 30))).toBe('2026-03-01');
  expect(localDate(new Date(2026, 0, 9, 0, 5))).toBe('2026-01-09');
});
