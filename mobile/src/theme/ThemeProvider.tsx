import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { dark, light, type Palette, type Weather } from './tokens';

type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  /** Today's signal colour. Defaults to 'fog' until a reading says otherwise. */
  signal: string;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ weather = 'fog', children }: { weather?: Weather; children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const value = useMemo<Theme>(() => {
    const colors = scheme === 'dark' ? dark : light;
    return { scheme, colors, signal: colors.signal[weather] };
  }, [scheme, weather]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
