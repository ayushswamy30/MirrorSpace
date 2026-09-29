import { test } from 'node:test';
import assert from 'node:assert/strict';

import { geminiRequest, geminiText, providerOrder } from '../../lib/aiProviders.js';

const all = { geminiApiKey: 'g', geminiPaidTier: false, groqApiKey: 'q', openaiApiKey: 'o' };

test('summaries may use Gemini first', () => {
  assert.deepEqual(providerOrder(all, { personal: false }), ['gemini', 'groq', 'openai']);
});

test('someone’s own writing never goes to Gemini’s unpaid tier', () => {
  assert.deepEqual(providerOrder(all, { personal: true }), ['groq', 'openai']);
  assert.deepEqual(providerOrder({ geminiApiKey: 'g', geminiPaidTier: false }, { personal: true }), []);
});

test('with billing enabled, personal writing may use Gemini', () => {
  assert.deepEqual(providerOrder({ ...all, geminiPaidTier: true }, { personal: true }), ['gemini', 'groq', 'openai']);
});

test('no keys, no providers', () => {
  assert.deepEqual(providerOrder({}, { personal: false }), []);
});

test('the request carries the system prompt separately from the user turn', () => {
  const body = geminiRequest({ system: 'be brief', prompt: 'hi', temperature: 0.5, maxTokens: 50 });
  assert.deepEqual(body.systemInstruction, { parts: [{ text: 'be brief' }] });
  assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'hi' }] }]);
  assert.deepEqual(body.generationConfig, { temperature: 0.5, maxOutputTokens: 50 });
  assert.equal('systemInstruction' in geminiRequest({ prompt: 'x', temperature: 1, maxTokens: 1 }), false);
});

test('reads the answer, skips thoughts, and returns null when there is none', () => {
  assert.equal(
    geminiText({ candidates: [{ content: { parts: [{ text: 'plan', thought: true }, { text: ' Hello ' }] } }] }),
    'Hello'
  );
  assert.equal(geminiText({ candidates: [{ finishReason: 'SAFETY' }] }), null);
  assert.equal(geminiText({}), null);
  assert.equal(geminiText(null), null);
});
