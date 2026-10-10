import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { ArtDisc } from '@/components/Art';
import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { registerForAlerts } from '@/lib/push';
import { enableReminders, remindersSupported } from '@/lib/reminders';

/**
 * One gentle reminder a day, offered once, near the end of onboarding — the
 * moment the phone asks for notification permission. Saying yes also lets
 * circle alerts through later. Skipped where notifications can't run (the
 * browser, Expo Go).
 */
export default function Reminder() {
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (!remindersSupported) router.replace('/onboarding/finish');
  }, []);

  if (!remindersSupported) return null;

  const turnOn = async () => {
    setBusy(true);
    const on = await enableReminders().catch(() => false);
    if (on) {
      registerForAlerts().catch(() => undefined);
      router.push('/onboarding/finish');
    } else {
      setDeclined(true);
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      actions={
        <>
          <Button label={busy ? 'one moment…' : 'remind me'} disabled={busy} onPress={turnOn} />
          <Button kind="link" label="not now" onPress={() => router.push('/onboarding/finish')} />
        </>
      }
    >
      <ArtDisc name="moka" size={96} style={{ alignSelf: 'flex-end' }} />
      <Text variant="title">A gentle nudge, once a day?</Text>
      <Text>
        Lowkei can remind you to check in — around nine in the evening at first, then at the time you usually do. It never says
        what you wrote, and you can turn it off in You.
      </Text>
      {declined && (
        <Text tone="soft">Notifications are off for Lowkei. You can allow them in your phone’s settings, then switch reminders on in You.</Text>
      )}
    </OnboardingStep>
  );
}
