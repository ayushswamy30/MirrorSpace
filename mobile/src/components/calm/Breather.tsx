import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { momentAt, type Pattern } from '@/lib/calm/breathing';
import { breathEasing } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const SMALL = 0.55;
const TICK_MS = 200;

type Props = {
  pattern: Pattern;
  onClose: () => void;
};

/**
 * One breathing pattern, guided. A ruled circle fills on the in-breath and
 * empties on the out-breath, over exactly the phase's length. With reduced
 * motion the circle stays still and the words and count carry the rhythm.
 */
export function Breather({ pattern, onClose }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const scale = useSharedValue(SMALL);
  const lastPhase = useRef<string | null>(null);

  const moment = momentAt(pattern, now - startedAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Each new phase starts one animation lasting the whole phase.
  const phaseKey = moment.done ? 'done' : `${moment.round}-${moment.phaseIndex}`;
  useEffect(() => {
    if (lastPhase.current === phaseKey) return;
    lastPhase.current = phaseKey;
    if (moment.done) {
      scale.value = withTiming(SMALL, { duration: 600 });
      return;
    }

    AccessibilityInfo.announceForAccessibility(moment.phase.cue);
    if (reduced || moment.phase.kind === 'hold') return;
    scale.value = withTiming(moment.phase.kind === 'in' ? 1 : SMALL, {
      duration: moment.secondsLeft * 1000,
      easing: breathEasing
    });
  }, [phaseKey, moment, reduced, scale]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const restart = () => {
    const start = Date.now();
    lastPhase.current = null;
    setStartedAt(start);
    setNow(start);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Animated.View
          style={[styles.circle, { borderColor: colors.ink }, reduced ? { transform: [{ scale: 0.8 }] } : circle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      {moment.done ? (
        <>
          <Text variant="title" style={styles.centre}>
            That’s it. Notice how you feel now.
          </Text>
          <View style={styles.actions}>
            <Button kind="outline" label="again" onPress={restart} />
            <Button kind="link" label="back" onPress={onClose} />
          </View>
        </>
      ) : (
        <>
          <Text variant="label" style={styles.centre} accessibilityLiveRegion="polite">
            {moment.phase.cue}
          </Text>
          <Text variant="reading" style={styles.centre} accessibilityElementsHidden>
            {moment.secondsLeft}
          </Text>
          <Text variant="mono" tone="soft" style={styles.centre}>
            {`round ${moment.round} of ${pattern.rounds}`}
          </Text>
          <View style={styles.actions}>
            <Button kind="link" label="stop" onPress={onClose} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingTop: space.lg },
  stage: { height: 240, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 220, height: 220, borderRadius: radius.dot, borderWidth: 1 },
  centre: { textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space.lg }
});
