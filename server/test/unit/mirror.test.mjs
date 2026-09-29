import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_CHARS, MAX_TURNS, MirrorValidationError, parseTurns } from '../../lib/mirror.js';

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
