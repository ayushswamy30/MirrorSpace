import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGES, readPage } from '../../routes/legal.js';

test('every legal page is a complete document', () => {
  for (const name of PAGES) {
    const html = readPage(name);
    assert.match(html, /^<!doctype html>/i, name);
    assert.match(html, /<title>[^<]+<\/title>/, name);
  }
});

// The consent screen for AI reflections names Groq (mobile/src/lib/consent.ts).
// If the provider changes, the policy has to change with it.
test('the privacy policy names the AI service the consent screen names', () => {
  assert.match(readPage('privacy'), /Groq/);
});
