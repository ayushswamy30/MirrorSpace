import { router } from 'expo-router';

import { ArtDisc } from '@/components/Art';
import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';

export default function Welcome() {
  return (
    <OnboardingStep actions={<Button label="begin" onPress={() => router.push('/onboarding/age')} />}>
      <ArtDisc name="eye" size={104} style={{ alignSelf: 'flex-end' }} />
      <Text variant="label" accessibilityLabel="MirrorSpace">
        mirror – space
      </Text>
      <Text variant="reading">A quiet room, not a clinic.</Text>
      <Text>
        MirrorSpace notices your patterns — sleep, rhythm, how you write — and reflects them back, one short
        reading a day. Every line can show what it was built from.
      </Text>
    </OnboardingStep>
  );
}
