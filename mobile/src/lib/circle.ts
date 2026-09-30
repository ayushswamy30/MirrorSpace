import type { ArtName } from '@/components/Art';
import type { Weather } from '@/theme/tokens';

import { api } from './api';
import { allCheckIns, localDate, type CheckIn } from './checkIns';
import { innerWeather } from './patterns';
import { isPreview } from './preview';

/**
 * Circle (report §4–5): a few friends who see each other's Inner Weather,
 * and nothing else. The phone decides what leaves it: the weather word, its
 * date, and seven numbers for how each weekday tends to go — computed here,
 * from check-ins that never leave the phone themselves.
 */

export type CircleFriend = {
  /** The friendship's id: what accept, remove and nudge are addressed to. */
  id: string;
  name: string;
  /** The picture they chose, or none. */
  icon: ArtName | null;
  weather: Weather | null;
  low: boolean;
  /** "You both run heavy on Thursdays." — only when both share. */
  rhythm: string | null;
  since: string | null;
};

export type CircleState = {
  me: { name: string | null; code: string | null; icon: ArtName | null; sharing: boolean; low: boolean };
  friends: CircleFriend[];
  incoming: { id: string; name: string; icon?: ArtName | null }[];
  outgoing: { id: string; name: string }[];
  nudges: { name: string; at: string }[];
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Average pleasantness per weekday, Monday first, over the last four weeks.
 * A weekday with fewer than two check-ins says nothing (null) rather than
 * something made up from one day.
 */
export function weekdayRhythm(checkIns: readonly CheckIn[], now: Date = new Date()): (number | null)[] {
  const from = now.getTime() - 28 * DAY;
  const days: number[][] = Array.from({ length: 7 }, () => []);
  for (const c of checkIns) {
    const at = new Date(c.createdAt);
    if (at.getTime() < from) continue;
    days[(at.getDay() + 6) % 7].push(c.pleasantness);
  }
  return days.map(values =>
    values.length < 2 ? null : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
  );
}

// --- The browser preview's stand-in circle ---------------------------------

let previewState: CircleState = {
  me: { name: 'You', code: 'K7M2QX', icon: 'swan', sharing: true, low: false },
  friends: [
    { id: 'p1', name: 'Asha', icon: 'orchid', weather: 'fog', low: true, rhythm: 'You both run heavy on Thursdays.', since: null },
    { id: 'p2', name: 'Ben', icon: 'cat', weather: 'clear', low: false, rhythm: 'Sundays tend to be good for you both.', since: null },
    { id: 'p3', name: 'Mira', icon: null, weather: 'overcast', low: false, rhythm: null, since: null }
  ],
  incoming: [{ id: 'p4', name: 'Kabir' }],
  outgoing: [],
  nudges: [{ name: 'Ben', at: new Date().toISOString() }]
};

// --- The API -----------------------------------------------------------------

export async function loadCircle(): Promise<CircleState> {
  if (isPreview) return previewState;
  return api.get<CircleState>('/circle');
}

/** The name, and optionally the picture, your circle sees. */
export async function setCircleName(name: string, icon?: ArtName | null): Promise<{ name: string; code: string }> {
  if (isPreview) {
    previewState = { ...previewState, me: { ...previewState.me, name, ...(icon === undefined ? {} : { icon }) } };
    return { name, code: previewState.me.code! };
  }
  return api.put('/circle/profile', icon === undefined ? { name } : { name, icon });
}

/** Resolves to the name of the person asked. */
export async function requestFriend(code: string): Promise<string> {
  if (isPreview) return 'Someone';
  const { name } = await api.post<{ name: string }>('/circle/requests', { code });
  return name;
}

export async function acceptFriend(id: string): Promise<void> {
  if (isPreview) {
    const asked = previewState.incoming.find(r => r.id === id);
    previewState = {
      ...previewState,
      incoming: previewState.incoming.filter(r => r.id !== id),
      friends: asked
        ? [...previewState.friends, { id, name: asked.name, icon: null, weather: null, low: false, rhythm: null, since: null }]
        : previewState.friends
    };
    return;
  }
  await api.post(`/circle/requests/${id}/accept`);
}

/** Decline, cancel or remove — all the same to the server. */
export async function removeFriend(id: string): Promise<void> {
  if (isPreview) {
    previewState = {
      ...previewState,
      friends: previewState.friends.filter(f => f.id !== id),
      incoming: previewState.incoming.filter(r => r.id !== id),
      outgoing: previewState.outgoing.filter(r => r.id !== id)
    };
    return;
  }
  await api.delete(`/circle/friends/${id}`);
}

export async function setRunningLow(on: boolean): Promise<void> {
  if (isPreview) {
    previewState = { ...previewState, me: { ...previewState.me, low: on } };
    return;
  }
  await api.put('/circle/low', { on });
}

export async function thinkingOfYou(id: string): Promise<void> {
  if (isPreview) return;
  await api.post(`/circle/friends/${id}/nudge`);
}

export async function markNudgesSeen(): Promise<void> {
  if (isPreview) {
    previewState = { ...previewState, nudges: [] };
    return;
  }
  await api.post('/circle/nudges/seen');
}

/**
 * Publishes today's weather and the weekday rhythm. Only ever called with the
 * circle consent on; the server refuses it otherwise.
 */
export async function shareStatus(now: Date = new Date()): Promise<void> {
  if (isPreview) return;
  const checkIns = await allCheckIns();
  const weather = innerWeather(checkIns, now);
  await api.put('/circle/status', {
    weather,
    date: weather ? localDate(now) : null,
    rhythm: weekdayRhythm(checkIns, now)
  });
}
