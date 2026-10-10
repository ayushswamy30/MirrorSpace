import { Platform } from 'react-native';

import { allCheckIns, recordCheckIn, setNote, setTags } from './checkIns';
import { findEmotion } from './emotions';
import type { Profile } from './session';
import { night, saveSleep } from './sleep';

/**
 * The browser preview: `npm run preview`. The app runs in a web page with a
 * stand-in profile and a month of made-up days, so every screen can be looked
 * at without a phone, an account, or the API. It never touches Supabase or
 * the server, and it cannot switch on in a phone build.
 *
 * The web app (`npm run build:web`, served at /app for iPhone) is the real
 * thing, not the preview: it sets EXPO_PUBLIC_WEB_APP=1.
 */
export const isPreview = Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_APP !== '1';

/** The real app running in a browser — the iPhone version, for now. */
export const isWebApp = Platform.OS === 'web' && !isPreview;

const DAY = 24 * 60 * 60 * 1000;

export function previewProfile(now: Date = new Date()): Profile {
  const at = new Date(now.getTime() - 40 * DAY).toISOString();
  const yes = { granted: true, at, policyVersion: 'preview' };
  return {
    id: 'preview',
    email: null,
    isAnonymous: true,
    intents: ['sleep', 'mood'],
    permissions: {},
    onboardingComplete: true,
    ageConfirmedAt: at,
    aiDisclosureSeenAt: at,
    consents: { readings: yes, ai_reflections: { granted: false, at: null, policyVersion: null }, health: yes, circle: yes },
    createdAt: at
  };
}

// A plausible month: mostly middling, a few bright days, a heavy patch.
const WORDS = [
  'calm', 'tired', 'content', 'focused', 'uneasy', 'okay', 'glad', 'drained', 'relaxed', 'tired',
  'hopeful', 'stressed', 'steady', 'calm', 'low', 'restful', 'cheerful', 'anxious', 'tired', 'content',
  'peaceful', 'okay', 'glad', 'down', 'calm', 'focused', 'mellow', 'tired', 'content', 'calm'
];
const TAGS = [['work'], ['sleep'], ['friends', 'outside'], ['work'], ['work', 'money'], [], ['friends'], ['work', 'sleep']];
const SKIPPED = new Set([3, 9, 16, 22]);

/** Fills an empty preview with thirty days of check-ins and nights. Idempotent. */
export async function seedPreview(now: Date = new Date()): Promise<void> {
  if ((await allCheckIns()).length > 0) return;

  for (let daysAgo = 29; daysAgo >= 1; daysAgo--) {
    if (SKIPPED.has(daysAgo)) continue;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 20 + (daysAgo % 3), (daysAgo * 7) % 60);
    const emotion = findEmotion(WORDS[daysAgo]);
    if (!emotion) continue;

    const checkIn = await recordCheckIn(emotion, day);
    const tags = TAGS[daysAgo % TAGS.length];
    if (tags.length) await setTags(checkIn.id, tags);
    if (daysAgo === 2) await setNote(checkIn.id, 'Long day, but the walk home helped.');

    if (daysAgo % 5 !== 0) {
      const bed = 22 * 60 + ((daysAgo * 37) % 150);
      const wake = 6 * 60 + ((daysAgo * 23) % 120);
      await saveSleep(night(bed % 1440, wake, day));
    }
  }
}

/**
 * Whether this browser can hold the app's database: expo-sqlite's web build
 * keeps it in the origin-private file system, from a worker, and needs
 * SharedArrayBuffer (so a cross-origin-isolated page).
 */
export function browserCanStore(): boolean {
  if (Platform.OS !== 'web') return true;
  const g = globalThis as { crossOriginIsolated?: boolean; navigator?: { storage?: { getDirectory?: unknown } } };
  return g.crossOriginIsolated === true && typeof g.navigator?.storage?.getDirectory === 'function';
}
