import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { allCheckIns, localDate, onCheckInsChanged } from './checkIns';
import { today, type Today } from './patterns';
import { useProfile } from './session';
import { allSleep, onSleepChanged } from './sleep';

/**
 * Today, recomputed on the phone whenever a check-in or a night changes, or
 * the app comes back to the front (the day may have turned). Readings are
 * personal only with the readings consent.
 */
export function useToday(): Today | null {
  const profile = useProfile();
  const personal = profile.consents.readings?.granted === true;
  const [value, setValue] = useState<Today | null>(null);

  const load = useCallback(() => {
    Promise.all([allCheckIns(), allSleep()])
      .then(([checkIns, sleep]) => {
        const now = new Date();
        setValue(today(checkIns, { personal, todayDate: localDate(now), now, sleep }));
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
