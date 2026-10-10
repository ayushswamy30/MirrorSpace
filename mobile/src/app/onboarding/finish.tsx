import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { submitOnboarding, useOnboarding } from '@/lib/onboarding';
import { useSession } from '@/lib/session';

export default function Finish() {
  const { draft } = useOnboarding();
  const { refreshProfile } = useSession();
  const [state, setState] = useState<'saving' | 'error'>('saving');
  // Bumped by "try again". Saving happens on arrival and on each retry, never
  // on its own.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await submitOnboarding(draft);
        await refreshProfile();
        if (!cancelled) router.replace('/');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, draft, refreshProfile]);

  const retry = () => {
    setState('saving');
    setAttempt(n => n + 1);
  };

  return (
    <OnboardingStep actions={state === 'error' ? <Button label="try again" onPress={retry} /> : null}>
      {state === 'saving' ? (
        <Text variant="title">Setting up your space.</Text>
      ) : (
        <>
          <Text variant="title">That didn’t reach us.</Text>
          <Text tone="soft">Your answers are still here. Check your connection and try again.</Text>
        </>
      )}
    </OnboardingStep>
  );
}
