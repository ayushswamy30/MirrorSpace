import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { dark, light, type Palette, type Weather } from './tokens';

type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  /** Today's signal colour. 'fog' until check-ins say otherwise. */
  signal: string;
  weather: Weather | null;
};

const ThemeContext = createContext<Theme | null>(null);
const SetWeatherContext = createContext<(weather: Weather | null) => void>(() => undefined);

/**
 * The palette for the system scheme, and the Inner Weather that picks the one
 * signal colour. The weather is set from outside (WeatherSync) once the
 * person's check-ins have been read; `weather` here only seeds it, for tests.
 */
export function ThemeProvider({ weather: initial = null, children }: { weather?: Weather | null; children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [weather, setWeather] = useState<Weather | null>(initial);

  const value = useMemo<Theme>(() => {
    const colors = scheme === 'dark' ? dark : light;
    return { scheme, colors, signal: colors.signal[weather ?? 'fog'], weather };
  }, [scheme, weather]);

  return (
    <SetWeatherContext.Provider value={setWeather}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </SetWeatherContext.Provider>
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
