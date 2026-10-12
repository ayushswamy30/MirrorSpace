/**
 * Web push — for the web app once it is added to a Home Screen. What a
 * browser may register, the times it may ask for, and what each message
 * says. Kept free of network and database code so it can be unit tested.
 *
 * The same lock-screen rule as the phone: no names, no feelings, no weather,
 * nothing of a letter.
 */

import { MESSAGES } from './push.js';

// Only the browsers' own push services. The server posts to whatever address
// a browser registers, so an open list would let anyone point it elsewhere.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/];
const P256DH = /^[A-Za-z0-9_-]{80,100}$/;
const AUTH = /^[A-Za-z0-9_-]{16,32}$/;

const DAY = 24 * 60 * 60 * 1000;
// The next reminder is at most a day and a bit away; a letter at most a year.
const REMINDER_HORIZON = 2 * DAY;
const LETTER_HORIZON = 400 * DAY;
const MAX_LETTERS = 100;
// A reflection shows a few hours after its page is kept.
const REFLECTION_HORIZON = 2 * DAY;
const MAX_REFLECTIONS = 20;

/** A reminder this late (the server was asleep) would land at the wrong hour; it is skipped. */
export const STALE_REMINDER_MS = 2 * 60 * 60 * 1000;

export class WebPushValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebPushValidationError';
  }
}

export function isPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.port === '' && url.username === '' && PUSH_HOSTS.some(host => host.test(url.hostname));
}

/** A browser's PushSubscription, as its toJSON() gives it. */
export function parseSubscription(subscription) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!isPushEndpoint(endpoint)) throw new WebPushValidationError('subscription.endpoint must be a browser push service');
  if (typeof p256dh !== 'string' || !P256DH.test(p256dh)) throw new WebPushValidationError('subscription.keys.p256dh is invalid');
  if (typeof auth !== 'string' || !AUTH.test(auth)) throw new WebPushValidationError('subscription.keys.auth is invalid');
  return { endpoint, p256dh, auth };
}

function when(value, now, horizon, field) {
  const at = typeof value === 'string' ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) throw new WebPushValidationError(`${field} must be a date`);
  if (at.getTime() > now.getTime() + horizon) throw new WebPushValidationError(`${field} is too far ahead`);
  return at;
}

function dates(body, field, kind, max, horizon, now) {
  const values = body?.[field] ?? [];
  if (!Array.isArray(values) || values.length > max) throw new WebPushValidationError(`${field} must be at most ${max} dates`);
  return values.map(value => when(value, now, horizon, field)).filter(at => at > now).map(at => ({ kind, sendAt: at.toISOString() }));
}

/** The person's switch for letters, reflections and Circle alerts; on unless they said no. */
export function parseAlerts(body) {
  if (body?.alerts == null) return true;
  if (typeof body.alerts !== 'boolean') throw new WebPushValidationError('alerts must be true or false');
  return body.alerts;
}

/**
 * The next reminder (or null), each sealed letter's day and each waiting
 * reflection's hour, as rows to keep. Times already past are dropped: the
 * app asks again whenever it opens. With alerts off, only the reminder.
 */
export function parseSchedule(body, now = new Date()) {
  const rows = [];
  if (body?.reminderAt != null) {
    const at = when(body.reminderAt, now, REMINDER_HORIZON, 'reminderAt');
    if (at > now) rows.push({ kind: 'reminder', sendAt: at.toISOString() });
  }
  const letters = dates(body, 'letters', 'letter', MAX_LETTERS, LETTER_HORIZON, now);
  const reflections = dates(body, 'reflections', 'reflection', MAX_REFLECTIONS, REFLECTION_HORIZON, now);
  return parseAlerts(body) ? [...rows, ...letters, ...reflections] : rows;
}

const WEB_MESSAGES = {
  reminder: { body: 'A word for today, if you have one.', url: '/' },
  test: { body: 'A word for today, if you have one.', url: '/' },
  letter: { body: 'A letter you wrote is ready, when you are.', url: '/check-in?mode=letter' },
  reflection: { body: 'A reflection on something you wrote is waiting.', url: '/check-in?mode=vent' },
  ...Object.fromEntries(Object.entries(MESSAGES).map(([kind, { body }]) => [kind, { body, url: '/circle' }]))
};

/** What the service worker shows: a title, a line, and where a tap goes. */
export function webMessage(kind) {
  const message = WEB_MESSAGES[kind];
  if (!message) throw new Error(`unknown web push kind: ${kind}`);
  // One reminder, letter or reflection notice on screen at a time; each Circle alert stands alone.
  const tag = kind === 'test' ? 'reminder' : ['reminder', 'letter', 'reflection'].includes(kind) ? kind : undefined;
  return JSON.stringify({ title: 'Lowkei', body: message.body, url: message.url, ...(tag ? { tag } : {}) });
}

/** Due rows worth sending now: a reminder that is hours late is let go. */
export function worthSending(row, now = new Date()) {
  return row.kind !== 'reminder' || now.getTime() - new Date(row.send_at).getTime() <= STALE_REMINDER_MS;
}

/** The push service says this subscription is gone for good. */
export function isGone(error) {
  return error?.statusCode === 404 || error?.statusCode === 410;
}
