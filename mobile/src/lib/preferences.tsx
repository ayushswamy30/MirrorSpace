import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { ArtName } from '@/components/Art';

/**
 * How the person likes the app to feel, chosen under You. Like the
 * appearance, these live outside the encrypted database: they are needed
 * before it opens, and say nothing about the person.
 */
export type Motion = 'full' | 'gentle' | 'still';
export type WeekStart = 'sunday' | 'monday';
/** Today's picture: a new one each day, or always the same one. */
export type Picture = 'daily' | ArtName;

export type Preferences = { motion: Motion; weekStart: WeekStart; picture: Picture };

export const DEFAULT_PREFERENCES: Preferences = { motion: 'full', weekStart: 'monday', picture: 'daily' };

const KEY = 'mirrorspace.preferences.v1';

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

async function write(value: string): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value);
  else await SecureStore.setItemAsync(KEY, value);
}

function parse(raw: string | null): Preferences {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
    return {
      motion: saved.motion === 'gentle' || saved.motion === 'still' ? saved.motion : 'full',
      weekStart: saved.weekStart === 'sunday' ? 'sunday' : 'monday',
      picture: typeof saved.picture === 'string' ? saved.picture : 'daily'
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

type Control = Preferences & { set: (change: Partial<Preferences>) => void };

const PreferencesContext = createContext<Control>({ ...DEFAULT_PREFERENCES, set: () => undefined });

export function PreferencesProvider({ seed, children }: { seed?: Partial<Preferences>; children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>({ ...DEFAULT_PREFERENCES, ...seed });

  useEffect(() => {
    if (seed) return;
    let cancelled = false;
    read()
      .then(raw => {
        if (!cancelled) setPrefs(parse(raw));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [seed]);

  const value = useMemo<Control>(
    () => ({
      ...prefs,
      set: change =>
        setPrefs(current => {
          const next = { ...current, ...change };
          write(JSON.stringify(next)).catch(err => console.warn('Preferences not saved:', err));
          return next;
        })
    }),
    [prefs]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Control {
  return useContext(PreferencesContext);
}

/**
 * How much to move: 'still' when the person or their phone asks for less
 * motion, otherwise their choice. Every animation in the app goes through
 * this, so a single setting quiets all of it.
 */
export function useMotion(): Motion {
  const reduced = useReducedMotion();
  const { motion } = usePreferences();
  return reduced ? 'still' : motion;
}
