import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

/**
 * Chart — patterns from day 7; the Mind Chart (day 14), Year in Weather and
 * experiments are v1.
 */
export default function Chart() {
  return (
    <Locked feature="patterns" promise="Your patterns, once there are enough days to see them.">
      <Screen>
        <Text variant="label" tone="soft">
          chart
        </Text>
      </Screen>
    </Locked>
  );
}
