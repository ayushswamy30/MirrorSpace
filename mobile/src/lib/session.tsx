import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError } from './api';
import type { ConsentPurpose } from './consent';
import { kv } from './db/kv';
import { isPreview, previewProfile, seedPreview } from './preview';
import { supabase } from './supabase';

/**
 * Anonymous-first, like the web app: opening the app mints an anonymous
 * Supabase session, and the API provisions the user row on first sight.
 *
 * Offline-tolerant: once a session exists on the device, the app opens on the
 * cached profile even when the network is down, so check-ins, vent and calm
 * tools keep working. Only the very first launch needs a connection.
 */

export type ConsentState = { granted: boolean; at: string | null; policyVersion: string | null };

export type Profile = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  intents: string[];
  permissions: Record<string, boolean>;
  onboardingComplete: boolean;
  ageConfirmedAt: string | null;
  aiDisclosureSeenAt: string | null;
  consents: Record<ConsentPurpose, ConsentState>;
  createdAt: string;
};

/**
 * Accounts that onboarded on the web app never saw the age gate or the AI
 * disclosure, so the phone asks for both before it opens.
 */
export function needsOnboarding(profile: Profile): boolean {
  return !profile.onboardingComplete || !profile.ageConfirmedAt || !profile.aiDisclosureSeenAt;
}

type SessionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: Profile; offline: boolean };

type SessionContextValue = SessionState & {
  retry: () => void;
  /** Re-read the profile after something changed it (onboarding, upgrade). */
  refreshProfile: () => Promise<void>;
};

const PROFILE_CACHE_KEY = 'profile.cache';

const SessionContext = createContext<SessionContextValue | null>(null);

async function ensureSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

async function fetchProfile(): Promise<Profile> {
  const profile = await api.get<Profile>('/user/profile');
  await kv.set(PROFILE_CACHE_KEY, JSON.stringify(profile));
  return profile;
}

async function cachedProfile(): Promise<Profile | null> {
  const raw = await kv.get(PROFILE_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isPreview) {
        await seedPreview().catch(err => console.warn('Preview data not seeded:', err));
        if (!cancelled) setState({ status: 'ready', profile: previewProfile(), offline: false });
        return;
      }
      try {
        await ensureSession();
        const profile = await fetchProfile();
        if (!cancelled) setState({ status: 'ready', profile, offline: false });
      } catch (error) {
        // A 401 means the stored session is dead (e.g. the account was erased
        // on another device). Falling back to the cache would show a ghost.
        const deadSession = error instanceof ApiError && error.status === 401;
        const cached = deadSession ? null : await cachedProfile().catch(() => null);
        if (cancelled) return;

        if (cached) {
          setState({ status: 'ready', profile: cached, offline: true });
        } else {
          setState({
            status: 'error',
            message: 'MirrorSpace needs a connection the first time it opens.'
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt(n => n + 1);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (isPreview) return;
    const profile = await fetchProfile();
    setState({ status: 'ready', profile, offline: false });
  }, []);

  const value = useMemo(() => ({ ...state, retry, refreshProfile }), [state, retry, refreshProfile]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** For screens that only render once the session is ready. */
export function useProfile(): Profile {
  const session = useSession();
  if (session.status !== 'ready') throw new Error('useProfile called before the session was ready');
  return session.profile;
}
