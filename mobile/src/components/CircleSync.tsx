import { useEffect } from 'react';
import { AppState } from 'react-native';

import { shareStatus } from '@/lib/circle';
import { onCheckInsChanged } from '@/lib/checkIns';
import { useProfile } from '@/lib/session';

/**
 * Keeps what the circle sees in step with the phone: today's weather and the
 * weekday rhythm, re-shared when a check-in lands or the app comes back.
 * Only with the circle consent on. Renders nothing.
 */
export function CircleSync() {
  const sharing = useProfile().consents.circle?.granted === true;

  useEffect(() => {
    if (!sharing) return;
    const share = () => {
      shareStatus().catch(err => console.warn('Circle not updated:', err));
    };
    share();
    const off = onCheckInsChanged(share);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') share();
    });
    return () => {
      off();
      sub.remove();
    };
  }, [sharing]);

  return null;
}
