import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { kv } from './db/kv';

/**
 * App lock (Face ID / fingerprint, falling back to the device passcode).
 *
 * Suggested — not forced — at onboarding. When on, the app locks at launch and
 * every time it goes to the background. Whenever the app is not in the
 * foreground a privacy cover hides the screen, so the app switcher never shows
 * a journal page, lock or no lock.
 */

const ENABLED_KEY = 'appLock.enabled';

export type LockAvailability = 'available' | 'no-passcode' | 'unknown';

/** Can this device lock the app at all? It needs at least a passcode. */
export async function lockAvailability(): Promise<LockAvailability> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level === LocalAuthentication.SecurityLevel.NONE ? 'no-passcode' : 'available';
  } catch {
    return 'unknown';
  }
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock MirrorSpace',
    cancelLabel: 'Not now',
    // Falling back to the passcode keeps people who can’t use biometrics — or
    // whose face or finger isn’t reading today — from being locked out.
    disableDeviceFallback: false
  });
  return result.success;
}

type AppLockValue = {
  enabled: boolean;
  locked: boolean;
  /** The app is not in the foreground: hide what is on screen. */
  covered: boolean;
  unlock: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

const AppLockContext = createContext<AppLockValue | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(AppState.currentState !== 'active');
  // Until the saved preference has been read, assume the screen needs hiding:
  // otherwise a locked app shows its content for a moment on every launch.
  const [settled, setSettled] = useState(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    kv.get(ENABLED_KEY)
      .then(value => {
        if (cancelled) return;
        const on = value === '1';
        enabledRef.current = on;
        setEnabledState(on);
        if (on) setLocked(true);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      setCovered(state !== 'active');
      // 'background', not 'inactive': the Face ID prompt itself makes the app
      // inactive, and locking on that would loop.
      if (state === 'background' && enabledRef.current) setLocked(true);
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) setLocked(false);
    return ok;
  }, []);

  const setEnabled = useCallback(async (on: boolean) => {
    await kv.set(ENABLED_KEY, on ? '1' : '0');
    enabledRef.current = on;
    setEnabledState(on);
  }, []);

  const value = useMemo(
    // The browser preview has no app switcher to hide from, and a tab that
    // isn't focused would otherwise stay covered.
    () => ({ enabled, locked, covered: Platform.OS !== 'web' && (covered || !settled), unlock, setEnabled }),
    [enabled, locked, covered, settled, unlock, setEnabled]
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock must be used inside <AppLockProvider>');
  return value;
}
