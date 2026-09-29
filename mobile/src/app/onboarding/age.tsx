import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { ageGate } from '@/lib/onboarding';

export default function Age() {
  return (
    <OnboardingStep
      actions={
        <>
          <Button label="yes, I’m 18 or older" onPress={() => router.push('/onboarding/disclosure')} />
          <Button
            kind="quiet"
            label="no, I’m under 18"
            onPress={async () => {
              await ageGate.markUnder18().catch(() => undefined);
              router.replace('/onboarding/under-18');
            }}
          />
        </>
      }
    >
      <Text variant="title">Are you 18 or older?</Text>
      <Text tone="soft">MirrorSpace is only for adults for now.</Text>
    </OnboardingStep>
  );
}
