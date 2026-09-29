import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { authenticate, lockAvailability, useAppLock } from '@/lib/appLock';

/**
 * The app lock is suggested, not required (report §4: "on by default
 * suggestion at onboarding"). A phone with no passcode can't lock anything,
 * so the question is skipped there rather than asked and then failing.
 */
export default function Lock() {
  const { setEnabled } = useAppLock();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    lockAvailability().then(a => setAvailable(a === 'available'));
  }, []);

  useEffect(() => {
    if (available === false) router.replace('/onboarding/finish');
  }, [available]);

  if (!available) return null;

  const turnOn = async () => {
    // Confirm it works once before relying on it, so nobody is locked out by
    // a setting they never saw succeed.
    if (await authenticate()) {
      await setEnabled(true);
      router.push('/onboarding/finish');
    } else {
      setFailed(true);
    }
  };

  return (
    <OnboardingStep
      actions={
        <>
          <Button label="lock it" onPress={turnOn} />
          <Button kind="link" label="not now" onPress={() => router.push('/onboarding/finish')} />
        </>
      }
    >
      <Text variant="title">Lock MirrorSpace with Face ID, your fingerprint or your passcode?</Text>
      <Text>What you write here stays on this phone. A lock keeps it yours even when someone else picks it up.</Text>
      {failed && <Text tone="soft">That didn’t go through. You can try again, or leave it for now.</Text>}
    </OnboardingStep>
  );
}
