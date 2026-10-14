import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { allBodyDays, bodyConnected, bodyFacts } from './body';
import { allCheckIns, localDate, onCheckInsChanged } from './checkIns';
import { forecast, type Forecast } from './forecast';
import { today, type Today } from './patterns';
import { useProfile } from './session';
import { allSleep, onSleepChanged } from './sleep';
import { listVents } from './vents';

/**
 * Today, recomputed on the phone whenever a check-in or a night changes, or
 * the app comes back to the front (the day may have turned). Readings — and
 * tomorrow's forecast — are personal only with the readings consent; either
 * way the reading is written for this account and this day (reading.ts).
 */
export type TodayView = Today & { forecast: Forecast | null };

export function useToday(): TodayView | null {
  const profile = useProfile();
  const personal = profile.consents.readings?.granted === true;
  const seed = profile.id;
  const [value, setValue] = useState<TodayView | null>(null);

  const load = useCallback(() => {
    const body = bodyConnected().then(on => (on ? allBodyDays() : []));
    const pages = personal ? listVents(30).catch(() => []) : Promise.resolve([]);
    Promise.all([allCheckIns(), allSleep(), body.catch(() => []), pages])
      .then(([checkIns, sleep, days, kept]) => {
        const now = new Date();
        const extra = days.length ? bodyFacts(days, checkIns, now) : [];
        setValue({
          ...today(checkIns, { personal, todayDate: localDate(now), now, sleep, extra, pages: kept, seed }),
          forecast: personal ? forecast(checkIns, sleep, now) : null
        });
      })
      .catch(err => console.warn('Today unavailable:', err));
  }, [personal, seed]);

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
