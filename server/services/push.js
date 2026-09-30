import * as push from '../db/push.js';
import { buildBatches, deadTokens, EXPO_PUSH_URL } from '../lib/push.js';

const TIMEOUT_MS = 10_000;

/**
 * Send a Circle alert to these people's phones, through Expo's push service
 * (free, no key needed). Never awaited by a request and never throws: a push
 * that doesn't arrive must not undo the thing that happened.
 */
export function notify(userIds, kind) {
  deliver(userIds, kind).catch(err => console.warn(`push.${kind} not sent:`, err.message));
}

async function deliver(userIds, kind) {
  const tokens = await push.tokensFor(userIds);
  for (const batch of buildBatches(tokens, kind)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Expo push answered ${res.status}`);
      await push.forget(deadTokens(batch, await res.json()));
    } finally {
      clearTimeout(timer);
    }
  }
}
