import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseConsentChanges, currentConsents, ConsentValidationError, CONSENT_PURPOSES } from '../../lib/consent.js';

test('no consents given is no changes', () => {
  assert.deepEqual(parseConsentChanges(undefined, undefined), []);
  assert.deepEqual(parseConsentChanges({}, undefined), []);
});

test('parses a grant and a withdrawal with the policy version', () => {
  assert.deepEqual(parseConsentChanges({ readings: true, ai_reflections: false }, ' 2026-10 '), [
    { purpose: 'readings', granted: true, policyVersion: '2026-10' },
    { purpose: 'ai_reflections', granted: false, policyVersion: '2026-10' }
  ]);
});

test('rejects unknown purposes instead of dropping them', () => {
  assert.throws(() => parseConsentChanges({ marketing: true }, 'v1'), ConsentValidationError);
});

test('rejects anything that is not a real boolean', () => {
  assert.throws(() => parseConsentChanges({ readings: 'yes' }, 'v1'), ConsentValidationError);
  assert.throws(() => parseConsentChanges({ readings: 1 }, 'v1'), ConsentValidationError);
});

test('requires the policy version whenever consent changes', () => {
  assert.throws(() => parseConsentChanges({ readings: true }), ConsentValidationError);
  assert.throws(() => parseConsentChanges({ readings: true }, '   '), ConsentValidationError);
});

test('rejects a non-object payload', () => {
  assert.throws(() => parseConsentChanges(['readings'], 'v1'), ConsentValidationError);
  assert.throws(() => parseConsentChanges('readings', 'v1'), ConsentValidationError);
});

test('current state is the latest event per purpose, whatever the order', () => {
  const state = currentConsents([
    { purpose: 'readings', granted: false, policyVersion: 'v1', createdAt: '2026-10-03T00:00:00Z' },
    { purpose: 'readings', granted: true, policyVersion: 'v1', createdAt: '2026-10-01T00:00:00Z' },
    { purpose: 'ai_reflections', granted: true, policyVersion: 'v1', createdAt: '2026-10-02T00:00:00Z' }
  ]);

  assert.equal(state.readings.granted, false);
  assert.equal(state.readings.at, '2026-10-03T00:00:00Z');
  assert.equal(state.ai_reflections.granted, true);
});

test('a purpose never asked about is not granted', () => {
  const state = currentConsents([]);
  for (const purpose of CONSENT_PURPOSES) {
    assert.deepEqual(state[purpose], { granted: false, at: null, policyVersion: null });
  }
});
