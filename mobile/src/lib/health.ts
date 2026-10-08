import { Platform } from 'react-native';
import type * as HealthConnectModule from 'react-native-health-connect';

import { setConsent } from './account';
import { BODY_PERMISSIONS, deleteBodyDays, setBodyConnected, syncBody } from './body';
import { localDate } from './checkIns';
import { kv } from './db/kv';
import { inExpoGo } from './runtime';
import { deleteHealthNights, saveHealthNights, type SleepLog } from './sleep';

/**
 * Sleep from Health Connect (Android). Asked in context, with the "health"
 * consent screen, and only for sleep sessions — steps and heart are a
 * second, separate ask (body.ts). Nights read here stay on the
 * phone, fill only the nights not logged by hand, and are deleted again if
 * it is turned off.
 *
 * Needs Lowkei's own build: Health Connect is not in Expo Go. Apple
 * Health (HealthKit) needs a paid Apple developer account and comes later.
 */

const CONNECTED_KEY = 'health.connected';
const DAYS_READ = 30;
const MIN_NIGHT = 60;
const MAX_NIGHT = 20 * 60;

export type HealthAvailability = 'available' | 'needs-update' | 'unavailable' | 'needs-app-build' | 'not-android';

export function healthPlatform(): Exclude<HealthAvailability, 'available' | 'needs-update' | 'unavailable'> | null {
  if (Platform.OS !== 'android') return 'not-android';
  if (inExpoGo) return 'needs-app-build';
  return null;
}

function module(): typeof HealthConnectModule | null {
  if (healthPlatform()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-health-connect') as typeof HealthConnectModule;
}

export async function healthAvailability(): Promise<HealthAvailability> {
  const blocked = healthPlatform();
  if (blocked) return blocked;
  const H = module()!;
  const status = await H.getSdkStatus();
  if (status === H.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  if (status === H.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
  return 'unavailable';
}

export async function healthConnected(): Promise<boolean> {
  return !healthPlatform() && (await kv.get(CONNECTED_KEY)) === '1';
}

/**
 * Health Connect sleep sessions → one night per morning: the longest session
 * that ended on that day (naps lose to the night), between one and twenty
 * hours long.
 */
export function nightsFromSessions(sessions: readonly { startTime: string; endTime: string }[]): SleepLog[] {
  const byMorning = new Map<string, SleepLog>();
  for (const s of sessions) {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (!(minutes >= MIN_NIGHT && minutes <= MAX_NIGHT)) continue;
    const night: SleepLog = {
      wakeDate: localDate(end),
      bedAt: start.toISOString(),
      wakeAt: end.toISOString(),
      minutes,
      source: 'health'
    };
    const kept = byMorning.get(night.wakeDate);
    if (!kept || night.minutes > kept.minutes) byMorning.set(night.wakeDate, night);
  }
  return [...byMorning.values()].sort((a, b) => a.wakeDate.localeCompare(b.wakeDate));
}

/** Reads the last month of sleep into the phone's own log. */
export async function syncHealthSleep(now: Date = new Date()): Promise<number> {
  const H = module();
  if (!H || !(await healthConnected())) return 0;
  await H.initialize();
  const from = new Date(now.getTime() - DAYS_READ * 24 * 60 * 60 * 1000);
  const result = await H.readRecords('SleepSession', {
    timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: now.toISOString() }
  });
  const nights = nightsFromSessions(result.records);
  await saveHealthNights(nights);
  await syncBody(H, now).catch(err => console.warn('Body sync failed:', err));
  return nights.length;
}

export type ConnectResult = 'connected' | 'declined' | 'needs-connection' | 'unavailable';

/**
 * Ask Android for sleep, and nothing else. The consent goes into the
 * server's consent log like every other; if that can't be recorded, nothing
 * is read and the Android permission is handed back.
 */
export async function connectHealth(): Promise<ConnectResult> {
  const H = module();
  if (!H || !(await H.initialize())) return 'unavailable';
  const granted = await H.requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
  const ok = granted.some(p => 'recordType' in p && p.recordType === 'SleepSession' && p.accessType === 'read');
  if (!ok) return 'declined';

  try {
    await setConsent('health', true);
  } catch {
    await H.revokeAllPermissions().catch(() => undefined);
    return 'needs-connection';
  }
  await kv.set(CONNECTED_KEY, '1');
  await syncHealthSleep().catch(err => console.warn('First health sync failed:', err));
  return 'connected';
}

/**
 * Steps, resting heart rate and HRV: a second ask, on top of sleep, for
 * these three only. Android may grant some and not others; whatever is
 * granted is read.
 */
export async function connectBody(): Promise<'connected' | 'declined' | 'unavailable'> {
  const H = module();
  if (!H || !(await healthConnected()) || !(await H.initialize())) return 'unavailable';
  const granted = await H.requestPermission([...BODY_PERMISSIONS]);
  const ok = granted.some(p => 'recordType' in p && BODY_PERMISSIONS.some(b => b.recordType === p.recordType));
  if (!ok) return 'declined';
  await setBodyConnected(true);
  await syncBody(H).catch(err => console.warn('First body sync failed:', err));
  return 'connected';
}

/** Stop reading the body, and forget what was read. Sleep stays connected. */
export async function disconnectBody(): Promise<void> {
  await setBodyConnected(false);
  await deleteBodyDays();
}

/** Withdraw: stop reading, forget what was read, and say so to the consent log. */
export async function disconnectHealth(): Promise<void> {
  await kv.set(CONNECTED_KEY, '0');
  await deleteHealthNights();
  await disconnectBody();
  await module()?.revokeAllPermissions().catch(() => undefined);
  await setConsent('health', false).catch(err => console.warn('Health withdrawal not recorded yet:', err));
}

export function openHealthSettings(): void {
  module()?.openHealthConnectSettings();
}
