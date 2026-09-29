import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';

export default function Welcome() {
  return (
    <OnboardingStep actions={<Button label="begin" onPress={() => router.push('/onboarding/age')} />}>
      <Text variant="label" tone="soft">
        mirrorspace
      </Text>
      <Text variant="reading">A quiet room, not a clinic.</Text>
      <Text>
        MirrorSpace notices your patterns — sleep, rhythm, how you write — and reflects them back, one short
        reading a day. Every line can show what it was built from.
      </Text>
    </OnboardingStep>
  );
}
