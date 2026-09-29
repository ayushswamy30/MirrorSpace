import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onCheckInsChanged } from '@/lib/checkIns';
import { syncReminder } from '@/lib/reminders';

// Someone already in the app doesn't need a banner telling them to open it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

/** Keeps the one pending reminder right. Renders nothing. */
export function ReminderSync() {
  useEffect(() => {
    const sync = () => {
      syncReminder().catch(err => console.warn('Reminder not scheduled:', err));
    };
    sync();
    const off = onCheckInsChanged(sync);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    return () => {
      off();
      sub.remove();
    };
  }, []);

  return null;
}
