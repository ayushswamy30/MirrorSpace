import webpush from 'web-push';

import { config } from '../config/env.js';
import * as store from '../db/webPush.js';
import { isGone, webMessage, worthSending } from '../lib/webPush.js';

const TIMEOUT_MS = 10_000;
const TICK_MS = 60_000;
// Long enough for a phone that is off for a day to still get its letter.
const TTL_SECONDS = 24 * 60 * 60;

const { publicKey, privateKey, subject } = config.webPush;
export const webPushConfigured = Boolean(publicKey && privateKey);
if (webPushConfigured) webpush.setVapidDetails(subject, publicKey, privateKey);

export function publicVapidKey() {
  return webPushConfigured ? publicKey : null;
}

/** Sends one message; true if it went, false if the subscription is gone (and forgotten). */
async function send(subscription, kind, text = null) {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      webMessage(kind, text),
      { TTL: TTL_SECONDS, timeout: TIMEOUT_MS, urgency: ['reminder', 'daily', 'letter', 'reflection'].includes(kind) ? 'normal' : 'high' }
    );
    return true;
  } catch (error) {
    if (!isGone(error)) throw error;
    await store.forget([subscription.endpoint]);
    return false;
  }
}

/**
 * A Circle alert to these people's Home Screen web apps. Never awaited by a
 * request and never throws, like the phone's.
 */
export function notifyWeb(userIds, kind) {
  if (!webPushConfigured) return;
  store
    .subscriptionsFor(userIds)
    .then(subscriptions => Promise.allSettled(subscriptions.map(s => send(s, kind))))
    .catch(err => console.warn(`webPush.${kind} not sent:`, err.message));
}

/** The test from You — today's note, if the app sent it — straight to the browser that asked. */
export async function sendTest(userId, endpoint, text = null) {
  const subscription = await store.find(userId, endpoint);
  return subscription ? send(subscription, 'test', text) : false;
}

/**
 * Sends every reminder, daily note and letter notice that has come due. Rows
 * are taken off first, so a slow or failing push is never sent twice.
 */
export async function sendDue(now = new Date()) {
  const rows = await store.due(now);
  if (rows.length === 0) return 0;
  await store.done(rows.map(r => r.id));
  const results = await Promise.allSettled(
    rows
      .filter(r => r.subscription && worthSending(r, now))
      .map(r => send(r.subscription, r.kind, r.kind === 'daily' ? { title: r.title, body: r.body } : null))
  );
  for (const r of results) if (r.status === 'rejected') console.warn('webPush scheduled not sent:', r.reason?.message);
  return results.filter(r => r.status === 'fulfilled' && r.value).length;
}

/**
 * Checks once a minute while the server is up. On Render's free tier it sleeps
 * when idle; the keep-awake workflow stops that, and anything that came due
 * while it slept goes out when it wakes (a long-late reminder is skipped).
 */
export function startWebPushTimer() {
  if (!webPushConfigured) {
    console.log('   Web push off: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set');
    return () => undefined;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sendDue();
    } catch (err) {
      console.warn('webPush tick failed:', err.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, TICK_MS);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
