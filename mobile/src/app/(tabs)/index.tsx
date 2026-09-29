import Animated from 'react-native-reanimated';

import { SectionLabel } from '@/components/Blocks';
import { AppHeader, shortDate } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useEntering } from '@/theme/motion';

/**
 * Today — the daily reading, its receipts, Inner Weather and Do/Don't
 * (DESIGN.md: "your day at a glance"). The reading itself lands in the Today
 * step; this is the frame it fills.
 */
export default function Today() {
  const first = useEntering();
  const second = useEntering(150);

  return (
    <Screen header={<AppHeader context={shortDate()} />}>
      <Animated.View entering={first}>
        <SectionLabel title="your day at a glance" rule={false} />
      </Animated.View>
      <Animated.View entering={second}>
        <Text variant="reading">Your first reading comes tomorrow morning.</Text>
      </Animated.View>
      <Text>It needs a night to read first. Check in before bed and the morning will have something to say.</Text>
    </Screen>
  );
}
