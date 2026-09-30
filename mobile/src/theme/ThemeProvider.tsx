import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance as NativeAppearance, useColorScheme } from 'react-native';

import { loadAppearance, saveAppearance, type Appearance } from '@/lib/appearance';

import { dark, light, type Palette, type Weather } from './tokens';

type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  /** Today's signal colour. 'fog' until check-ins say otherwise. */
  signal: string;
  weather: Weather | null;
};

type AppearanceControl = { appearance: Appearance; setAppearance: (appearance: Appearance) => void };

const ThemeContext = createContext<Theme | null>(null);
const SetWeatherContext = createContext<(weather: Weather | null) => void>(() => undefined);
const AppearanceContext = createContext<AppearanceControl>({ appearance: 'system', setAppearance: () => undefined });

/**
 * The palette — light, dark, or whatever the phone is set to — and the Inner
 * Weather that picks the one signal colour. The weather is set from outside
 * (WeatherSync) once the person's check-ins have been read; `weather` here
 * only seeds it, for tests.
 *
 * A chosen appearance is also handed to the native side, so switches, the
 * keyboard and system sheets follow the page instead of the phone.
 */
export function ThemeProvider({
  weather: initial = null,
  appearance: seeded,
  children
}: {
  weather?: Weather | null;
  /** Fixes the appearance, for tests; otherwise it is read from the phone. */
  appearance?: Appearance;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const [weather, setWeather] = useState<Weather | null>(initial);
  const [appearance, setAppearanceState] = useState<Appearance>(seeded ?? 'system');

  useEffect(() => {
    if (seeded) return;
    let cancelled = false;
    loadAppearance().then(saved => {
      if (!cancelled) setAppearanceState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [seeded]);

  useEffect(() => {
    NativeAppearance.setColorScheme?.(appearance === 'system' ? 'unspecified' : appearance);
  }, [appearance]);

  const scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;

  const value = useMemo<Theme>(() => {
    const colors = scheme === 'dark' ? dark : light;
    return { scheme, colors, signal: colors.signal[weather ?? 'fog'], weather };
  }, [scheme, weather]);

  const control = useMemo<AppearanceControl>(
    () => ({
      appearance,
      setAppearance: next => {
        setAppearanceState(next);
        saveAppearance(next);
      }
    }),
    [appearance]
  );

  return (
    <AppearanceContext.Provider value={control}>
      <SetWeatherContext.Provider value={setWeather}>
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
      </SetWeatherContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

export function useSetWeather(): (weather: Weather | null) => void {
  return useContext(SetWeatherContext);
}

/** Light, dark, or the phone's own setting — chosen under You. */
export function useAppearance(): AppearanceControl {
  return useContext(AppearanceContext);
}
