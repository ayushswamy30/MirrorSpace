import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onCheckInsChanged } from '@/lib/checkIns';
import { setNoteContext } from '@/lib/dailyNote';
import { quietWhileOpen, remindersSupported, syncReminder } from '@/lib/reminders';
import { useProfile } from '@/lib/session';
import { onSleepChanged } from '@/lib/sleep';

/**
 * Keeps the week's reminders and 11:11 notes right: rewritten when the app
 * opens, and when a check-in or a night changes what the notes would say.
 * Renders nothing; idle in Expo Go.
 */
export function ReminderSync() {
  const profile = useProfile();
  const personal = profile.consents.readings?.granted === true;
  const seed = profile.id;

  useEffect(() => {
    if (!remindersSupported) return;
    setNoteContext({ personal, seed });
    quietWhileOpen();

    const sync = () => {
      syncReminder().catch(err => console.warn('Reminder not scheduled:', err));
    };
    sync();
    const off = [onCheckInsChanged(sync), onSleepChanged(sync)];
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    return () => {
      off.forEach(f => f());
      sub.remove();
    };
  }, [personal, seed]);

  return null;
}
