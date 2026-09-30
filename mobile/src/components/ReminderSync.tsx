import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onCheckInsChanged } from '@/lib/checkIns';
import { quietWhileOpen, remindersSupported, syncReminder } from '@/lib/reminders';

/** Keeps the one pending reminder right. Renders nothing; idle in Expo Go. */
export function ReminderSync() {
  useEffect(() => {
    if (!remindersSupported) return;
    quietWhileOpen();

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
