import { HelplineList } from '@/components/HelplineList';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/**
 * The end of the road for now. No way forward, no way to re-answer: a teen
 * version needs its own legal review and parental-consent design (report §8).
 * The kindest thing this screen can do is point somewhere real.
 */
export default function Under18() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="title">MirrorSpace isn’t open to people under 18 yet.</Text>
      <Text>
        That’s about keeping you safe, not about you. If things feel heavy right now, these people are there to
        listen, for free:
      </Text>
      <HelplineList />
    </Screen>
  );
}
