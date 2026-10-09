import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { allBodyDays, bodyConnected, bodyFacts } from './body';
import { allCheckIns, localDate, onCheckInsChanged } from './checkIns';
import { forecast, type Forecast } from './forecast';
import { today, type Today } from './patterns';
import { useProfile } from './session';
import { allSleep, onSleepChanged } from './sleep';

/**
 * Today, recomputed on the phone whenever a check-in or a night changes, or
 * the app comes back to the front (the day may have turned). Readings — and
 * tomorrow's forecast — are personal only with the readings consent.
 */
export type TodayView = Today & { forecast: Forecast | null };

export function useToday(): TodayView | null {
  const profile = useProfile();
  const personal = profile.consents.readings?.granted === true;
  const [value, setValue] = useState<TodayView | null>(null);

  const load = useCallback(() => {
    const body = bodyConnected().then(on => (on ? allBodyDays() : []));
    Promise.all([allCheckIns(), allSleep(), body.catch(() => [])])
      .then(([checkIns, sleep, days]) => {
        const now = new Date();
        const extra = days.length ? bodyFacts(days, checkIns, now) : [];
        setValue({
          ...today(checkIns, { personal, todayDate: localDate(now), now, sleep, extra }),
          forecast: personal ? forecast(checkIns, sleep, now) : null
        });
      })
      .catch(err => console.warn('Today unavailable:', err));
  }, [personal]);

  useEffect(() => {
    load();
    const offCheckIns = onCheckInsChanged(load);
    const offSleep = onSleepChanged(load);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') load();
    });
    return () => {
      offCheckIns();
      offSleep();
      sub.remove();
    };
  }, [load]);

  return value;
}
