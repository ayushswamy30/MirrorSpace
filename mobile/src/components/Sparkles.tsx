import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useMotion } from '@/lib/preferences';

/**
 * Four-pointed sparkles that twinkle on their own slow clocks — the small
 * glints of light in the references, never more than a few at once.
 * Positions are fractions of the parent; still when less motion is asked for.
 */

export type Spark = { x: number; y: number; size: number; delay?: number };

const STAR = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z';

function Sparkle({ spark, clock, color }: { spark: Spark; clock: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const v = 0.5 + 0.5 * Math.sin(clock.value + (spark.delay ?? 0));
    return { opacity: 0.25 + 0.75 * v, transform: [{ scale: 0.6 + 0.4 * v }, { rotate: `${v * 25}deg` }] };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: `${spark.x * 100}%`, top: `${spark.y * 100}%`, width: spark.size, height: spark.size, marginLeft: -spark.size / 2, marginTop: -spark.size / 2 },
        style
      ]}
    >
      <Svg width={spark.size} height={spark.size} viewBox="0 0 24 24">
        <Path d={STAR} fill={color} />
      </Svg>
    </Animated.View>
  );
}

export function Sparkles({ sparks, color = '#FFFFFF', style }: { sparks: Spark[]; color?: string; style?: ViewStyle }) {
  const motion = useMotion();
  const clock = useSharedValue(1.2);

  useEffect(() => {
    if (motion === 'still') return;
    clock.value = withRepeat(withTiming(1.2 + Math.PI * 2, { duration: motion === 'gentle' ? 9000 : 4500, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [motion, clock]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sparks.map((s, i) => (
        <Sparkle key={i} spark={s} clock={clock} color={color} />
      ))}
    </View>
  );
}
