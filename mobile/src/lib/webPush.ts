import type * as ApiModule from './api';
import { getDatabase } from './db/database';
import { kv } from './db/kv';
import { isWebApp } from './preview';

/**
 * Notifications for the web app once it is on a Home Screen: the daily
 * reminder, a letter's day, a reflection that is ready, Circle alerts. On iPhone
 * (iOS 16.4 or later) that is the only place a web app may have them, so
 * Android is treated the same way.
 *
 * A browser can't schedule a notification for later, so the server sends
 * them: the browser subscribes with the browser's own push service and hands
 * the API that address with the times of the week's reminders, each sealed
 * letter and each waiting reflection, and the week's 11:11 notes with their
 * two lines (written on the phone; never a feeling word or anything written).
 * Circle alerts reach the same address. The service worker (site/app/sw.js)
 * shows them.
 */

/**
 * Loaded on use: reminders.ts imports this file everywhere, and the API
 * client brings a Supabase session with it.
 */
function api(): typeof ApiModule.api {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./api') as typeof ApiModule).api;
}

export type AlertPath = '/' | '/circle' | '/check-in?mode=letter' | '/check-in?mode=vent';
const PATHS: readonly string[] = ['/', '/circle', '/check-in?mode=letter', '/check-in?mode=vent'];

/** Letters, reflections and Circle alerts — everything but the reminder. On until switched off. */
const ALERTS_KEY = 'alerts.enabled';

function browserCanPush(): boolean {
  return (
    isWebApp &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Opened from the Home Screen rather than a browser tab. */
export function onHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const webPushSupported = browserCanPush() && onHomeScreen();

/** The web app in a browser tab: notifications wait for the Home Screen. */
export const needsHomeScreen = isWebApp && !webPushSupported;

export function webPushAllowed(): boolean {
  return webPushSupported && Notification.permission === 'granted';
}

export async function webAlertsOn(): Promise<boolean> {
  return webPushAllowed() && (await kv.get(ALERTS_KEY)) !== '0';
}

/** Saves the switch; syncReminder() then tells the server. */
export async function saveWebAlerts(on: boolean): Promise<void> {
  await kv.set(ALERTS_KEY, on ? '1' : '0');
}

/**
 * Asks the browser. Call it first thing in a tap's handler, before anything
 * else is awaited: iPhone only shows the question in direct answer to a tap.
 */
export async function askWebPush(): Promise<boolean> {
  if (!webPushSupported) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

function bytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((v, i) => v === b[i]);
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  // The page registers the worker once it has loaded; this covers a tap
  // that comes before that.
  const existing = await navigator.serviceWorker.getRegistration('/app/');
  if (!existing) await navigator.serviceWorker.register('/app/sw.js', { scope: '/app' });
  return navigator.serviceWorker.ready;
}

/** This browser's subscription, made (or remade for a new server key) if needed. */
async function subscription(): Promise<PushSubscription | null> {
  const reg = await registration().catch(() => null);
  if (!reg) return null;
  const { key } = await api().get<{ key: string | null }>('/user/web-push/key');
  if (!key) return null;
  const serverKey = bytes(key);
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameKey(existing.options.applicationServerKey, serverKey)) return existing;
  await existing?.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
}

async function upcoming(now: Date): Promise<{ letters: string[]; reflections: string[] }> {
  const db = await getDatabase();
  const letters = await db.getAllAsync<{ at: string }>(
    'SELECT deliver_at AS at FROM letters WHERE delivered_at IS NULL AND deliver_at > ? ORDER BY deliver_at LIMIT 100',
    now.toISOString()
  );
  const reflections = await db.getAllAsync<{ at: string }>(
    `SELECT reflection_at AS at FROM vents WHERE reflection_state = 'ready' AND reflection_at > ? ORDER BY reflection_at LIMIT 20`,
    now.toISOString()
  );
  return { letters: letters.map(r => r.at), reflections: reflections.map(r => r.at) };
}

let lastSent: string | null = null;

/** A note to show at a time: the 11:11 daily note. */
export type TimedNote = { at: Date; title: string; body: string };

/**
 * Tells the server where this browser's notifications go, whether it wants
 * more than the reminders, the week's reminders and 11:11 notes (with what
 * each note says), and when each sealed letter and waiting reflection is
 * due. Does nothing until notifications are allowed; never asks.
 */
export async function syncWebPush(
  week: { reminders: readonly Date[]; notes: readonly TimedNote[] },
  now: Date = new Date()
): Promise<boolean> {
  if (!webPushAllowed()) return false;
  const sub = await subscription();
  if (!sub) return false;
  const body = {
    subscription: sub.toJSON(),
    alerts: (await kv.get(ALERTS_KEY)) !== '0',
    reminders: week.reminders.map(at => at.toISOString()),
    notes: week.notes.map(n => ({ at: n.at.toISOString(), title: n.title, body: n.body })),
    ...(await upcoming(now))
  };
  const signature = JSON.stringify(body);
  if (signature === lastSent) return true;
  await api().put('/user/web-push', body);
  lastSent = signature;
  return true;
}

/** A test, sent by the server straight away: today's note, as it stands. */
export async function sendWebTest(note: { title: string; body: string }): Promise<boolean> {
  if (!webPushAllowed()) return false;
  const sub = await subscription();
  if (!sub) return false;
  await api().post('/user/web-push/test', { endpoint: sub.endpoint, title: note.title, body: note.body });
  return true;
}

/**
 * A tapped notification, with the app already open: the service worker
 * brings it forward and says where to go.
 */
export function onWebAlertTapped(open: (path: AlertPath) => void): () => void {
  if (!webPushSupported) return () => undefined;
  const listener = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; path?: unknown } | null;
    if (data?.type === 'open' && typeof data.path === 'string' && PATHS.includes(data.path)) open(data.path as AlertPath);
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
