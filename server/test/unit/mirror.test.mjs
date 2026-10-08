import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CHARS,
  MAX_MEMORY_CHARS,
  MAX_MEMORY_ITEMS,
  MAX_TURNS,
  memoryLines,
  MirrorValidationError,
  parseMemory,
  parsePage,
  parseTurns
} from '../../lib/mirror.js';

test('keeps roles and trimmed text', () => {
  assert.deepEqual(parseTurns([{ role: 'user', content: '  hi  ' }]), [{ role: 'user', content: 'hi' }]);
});

test('keeps only the tail of a long conversation', () => {
  const long = Array.from({ length: MAX_TURNS + 5 }, (_, i) => ({ role: i % 2 ? 'mirror' : 'user', content: `m${i}` }));
  long.push({ role: 'user', content: 'last' });
  const turns = parseTurns(long);
  assert.equal(turns.length, MAX_TURNS);
  assert.equal(turns[turns.length - 1].content, 'last');
});

test('must end on the person’s turn', () => {
  assert.throws(() => parseTurns([{ role: 'user', content: 'a' }, { role: 'mirror', content: 'b' }]), MirrorValidationError);
});

test('rejects empty lists, unknown roles, blank and oversized text', () => {
  assert.throws(() => parseTurns([]), MirrorValidationError);
  assert.throws(() => parseTurns('hi'), MirrorValidationError);
  assert.throws(() => parseTurns([{ role: 'system', content: 'x' }]), MirrorValidationError);
  assert.throws(() => parseTurns([{ role: 'user', content: '   ' }]), MirrorValidationError);
  assert.throws(() => parseTurns([{ role: 'user', content: 'x'.repeat(MAX_CHARS + 1) }]), MirrorValidationError);
});

test('a page for reflection is one non-empty page, within reason', () => {
  assert.equal(parsePage({ text: '  a long day  ' }), 'a long day');
  assert.throws(() => parsePage({ text: '   ' }), MirrorValidationError);
  assert.throws(() => parsePage({}), MirrorValidationError);
  assert.throws(() => parsePage({ text: 'x'.repeat(8001) }), MirrorValidationError);
});

test('memory is optional, and checked when it comes', () => {
  assert.equal(parseMemory(undefined), null);
  assert.equal(parseMemory([]), null);
  assert.deepEqual(parseMemory([{ id: 'p1', text: ' Short nights lately ', receipt: '3 of 7' }, { id: 'n1', text: 'I work nights' }]), [
    { id: 'p1', text: 'Short nights lately', receipt: '3 of 7' },
    { id: 'n1', text: 'I work nights' }
  ]);
  assert.throws(() => parseMemory('x'), MirrorValidationError);
  assert.throws(() => parseMemory([{ id: 'system', text: 'x' }]), MirrorValidationError);
  assert.throws(() => parseMemory([{ id: 'n1', text: 'x'.repeat(MAX_MEMORY_CHARS + 1) }]), MirrorValidationError);
  assert.throws(() => parseMemory(Array.from({ length: MAX_MEMORY_ITEMS + 1 }, (_, i) => ({ id: `n${i % 99}`, text: 'x' }))), MirrorValidationError);
});

test('memory reads as one tagged line per item', () => {
  assert.equal(memoryLines([{ id: 'p1', text: 'A', receipt: 'r' }, { id: 'n1', text: 'B' }]), '[p1] A (r)\n[n1] B');
});
