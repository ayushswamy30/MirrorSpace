import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SectionLabel } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { GROUNDING_STEPS } from '@/lib/calm/grounding';
import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';

/** 5-4-3-2-1, one sense per screen. Nothing is recorded. */
export function Grounding() {
  const [index, setIndex] = useState(0);
  const entering = useEntering();
  const step = GROUNDING_STEPS[index];

  if (!step) {
    return (
      <View style={styles.wrap}>
        <SectionLabel title="grounded" rule={false} />
        <Text variant="reading">You’re here, in this room, right now.</Text>
        <Text tone="soft">Take one more slow breath before you go on.</Text>
        <Button kind="link" label="start again" onPress={() => setIndex(0)} />
      </View>
    );
  }

  return (
    // Keyed by step so each one settles in on its own.
    <Animated.View key={step.count} entering={entering} style={styles.wrap}>
      <SectionLabel title={`${step.count} · ${step.sense}`} rule={false} />
      <Text variant="reading">{step.prompt}</Text>
      <Text variant="mono" tone="soft">
        {`${index + 1} / ${GROUNDING_STEPS.length}`}
      </Text>
      <Button arrow label={index === GROUNDING_STEPS.length - 1 ? 'finish' : 'next'} onPress={() => setIndex(i => i + 1)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingTop: space.md }
});
