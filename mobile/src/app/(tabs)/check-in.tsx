import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/** Check-in — emotion grid, context tags, optional note. Built in the check-in step. */
export default function CheckIn() {
  return (
    <Screen>
      <Text variant="label" tone="soft">
        check-in
      </Text>
      <Text variant="title">Where are you, right now?</Text>
    </Screen>
  );
}
