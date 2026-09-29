import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { allCheckIns, localDate, onCheckInsChanged } from './checkIns';
import { today, type Today } from './patterns';
import { useProfile } from './session';

/**
 * Today, recomputed on the phone whenever a check-in changes or the app comes
 * back to the front (the day may have turned). Readings are personal only
 * with the readings consent.
 */
export function useToday(): Today | null {
  const profile = useProfile();
  const personal = profile.consents.readings?.granted === true;
  const [value, setValue] = useState<Today | null>(null);

  const load = useCallback(() => {
    allCheckIns()
      .then(checkIns => {
        const now = new Date();
        setValue(today(checkIns, { personal, todayDate: localDate(now), now }));
      })
      .catch(err => console.warn('Today unavailable:', err));
  }, [personal]);

  useEffect(() => {
    load();
    const unsubscribe = onCheckInsChanged(load);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') load();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [load]);

  return value;
}
