import Animated from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useEntering } from '@/theme/motion';

/**
 * Today — the daily reading, its receipts, Inner Weather and Do/Don't.
 * The reading itself lands in the Today step; this is the frame it fills.
 */
export default function Today() {
  const first = useEntering();
  const second = useEntering(150);

  return (
    <Screen>
      <Animated.View entering={first}>
        <Text variant="label" tone="soft">
          today
        </Text>
      </Animated.View>
      <Animated.View entering={second}>
        <Text variant="reading">Your first reading comes tomorrow morning, once there is a night to read.</Text>
      </Animated.View>
    </Screen>
  );
}
