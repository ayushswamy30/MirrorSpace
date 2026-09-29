import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';

/**
 * AI disclosure and what MirrorSpace is not (California SB 243, Oregon
 * SB 1546, Utah; report §8). Worded in the product's voice but never softened:
 * software, not a person; not therapy; cannot get help for you.
 */
export default function Disclosure() {
  return (
    <OnboardingStep actions={<Button label="I understand" onPress={() => router.push('/onboarding/intents')} />}>
      <Text variant="title">Before anything else: the Mirror is software, not a person.</Text>
      <Text>
        Its words are written by an AI. It is not a therapist, it cannot diagnose anything, and it cannot call
        anyone for you.
      </Text>
      <Text>
        It notices patterns in what you share with it and says what it sees. That’s all it claims to do.
      </Text>
      <Text tone="soft">
        If you are ever in danger, crisis lines are under “calm”, at the top of every screen — tap calm, then help.
      </Text>
    </OnboardingStep>
  );
}
