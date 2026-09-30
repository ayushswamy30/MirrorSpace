import { router } from 'expo-router';
import { useEffect } from 'react';

import { onAlertTapped, pushSupported, registerForAlerts } from '@/lib/push';

/**
 * Keeps this phone's push token with the API (only once notifications are
 * allowed — it never asks), and opens Circle when an alert is tapped.
 * Renders nothing; idle in Expo Go and the browser preview.
 */
export function PushSync() {
  useEffect(() => {
    if (!pushSupported) return;
    registerForAlerts().catch(err => console.warn('Circle alerts not registered:', err));
    return onAlertTapped(path => router.navigate(path));
  }, []);

  return null;
}
