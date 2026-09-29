import Animated from 'react-native-reanimated';

import { Masthead } from '@/components/Masthead';
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
        <Masthead title="today" />
      </Animated.View>
      <Animated.View entering={second}>
        <Text variant="reading" style={{ textAlign: 'center' }}>
          Your first reading comes tomorrow morning, once there is a night to read.
        </Text>
      </Animated.View>
    </Screen>
  );
}
