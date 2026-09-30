/**
 * Push messages — what they say, and the shape Expo's push service expects.
 * Kept free of network and database code so it can be unit tested.
 *
 * Nothing personal on a lock screen, the same rule as the daily reminder:
 * no names, no feelings, no weather. A lock screen is read by whoever picks
 * the phone up. The app says who, once it's open.
 */

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/;
const PLATFORMS = ['android', 'ios'];

export class PushValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PushValidationError';
  }
}

export function parseRegistration(body) {
  const token = body?.token;
  const platform = body?.platform;
  if (typeof token !== 'string' || !TOKEN.test(token)) throw new PushValidationError('token must be an Expo push token');
  if (!PLATFORMS.includes(platform)) throw new PushValidationError('platform must be android or ios');
  return { token, platform };
}

export const MESSAGES = {
  request: { body: 'Someone would like to join your circle.' },
  accepted: { body: 'You’re in someone’s circle now.' },
  nudge: { body: 'Someone in your circle is thinking of you.' },
  low: { body: 'Someone in your circle is running low. A small check-in can mean a lot.' }
};

/** Expo's message objects, at most 100 per request as its API asks. */
export function buildBatches(tokens, kind) {
  const message = MESSAGES[kind];
  if (!message) throw new Error(`unknown push kind: ${kind}`);
  const all = tokens.map(to => ({
    to,
    title: 'MirrorSpace',
    body: message.body,
    sound: 'default',
    channelId: 'circle',
    // Where a tap goes, and nothing else.
    data: { url: '/circle' }
  }));
  const batches = [];
  for (let i = 0; i < all.length; i += 100) batches.push(all.slice(i, i + 100));
  return batches;
}

/** Tokens Expo says are gone for good, so they can be forgotten. */
export function deadTokens(batch, response) {
  const tickets = Array.isArray(response?.data) ? response.data : [];
  return tickets
    .map((ticket, i) => (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered' ? batch[i]?.to : null))
    .filter(Boolean);
}
