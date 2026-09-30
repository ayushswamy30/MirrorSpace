import { useEffect } from 'react';
import { AppState } from 'react-native';

import { healthPlatform, syncHealthSleep } from '@/lib/health';

/** Reads new nights from Health Connect when the app opens, if connected. Renders nothing. */
export function HealthSync() {
  useEffect(() => {
    if (healthPlatform()) return;
    const sync = () => {
      syncHealthSleep().catch(err => console.warn('Health sync failed:', err));
    };
    sync();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, []);

  return null;
}
