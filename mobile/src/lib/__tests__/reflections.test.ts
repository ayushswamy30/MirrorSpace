import { DELAY_MS, mayReflect, visibleReflection } from '../reflections';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../api', () => ({ api: {}, ApiError: class extends Error {} }));

test('a page that screens as a crisis is never sent for a reflection', () => {
  expect(mayReflect('a long day, and the bus was late again')).toBe(true);
  expect(mayReflect('i want to kill myself')).toBe(false);
});

test('a reflection stays hidden until its hour, then shows', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const at = new Date(now.getTime() + DELAY_MS).toISOString();
  const waiting = visibleReflection({ reflection: 'You wrote faster near the end.', reflectionAt: at }, now);
  expect(waiting.text).toBeNull();
  expect(waiting.waitingUntil?.toISOString()).toBe(at);

  const later = visibleReflection({ reflection: 'You wrote faster near the end.', reflectionAt: at }, new Date(now.getTime() + DELAY_MS + 1));
  expect(later.text).toBe('You wrote faster near the end.');
});

test('no reflection, nothing to show', () => {
  expect(visibleReflection({ reflection: null, reflectionAt: null })).toEqual({ text: null, waitingUntil: null });
});
