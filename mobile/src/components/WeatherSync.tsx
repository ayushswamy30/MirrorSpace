import { useEffect } from 'react';

import { useToday } from '@/lib/useToday';
import { useSetWeather } from '@/theme/ThemeProvider';

/** Keeps the signal colour on today's Inner Weather. Renders nothing. */
export function WeatherSync() {
  const data = useToday();
  const setWeather = useSetWeather();
  const weather = data?.weather ?? null;

  useEffect(() => {
    setWeather(weather);
  }, [weather, setWeather]);

  return null;
}
