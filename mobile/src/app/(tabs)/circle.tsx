import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/**
 * Circle — friends, rhythm compatibility, the low-battery signal. The whole
 * social layer is v1 (report §4–5); the tab exists so the app's shape does not
 * change under people when it arrives.
 */
export default function Circle() {
  return (
    <Screen>
      <Text variant="label" tone="soft">
        circle
      </Text>
      <Text variant="title">A few people who can see your weather, and nothing else.</Text>
      <Text tone="soft">Circles arrive in a later version.</Text>
    </Screen>
  );
}
