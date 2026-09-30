import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useMotion } from '@/lib/preferences';
import { gutter, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/**
 * The bottom of a feed, after the reference: not a flat block but a mound of
 * ink with a soft, uneven top, and droplets hanging in the air above it. The
 * top edge breathes and the droplets drift, slowly — the page ends by being
 * still, almost. With less motion asked for, it is simply still.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HEIGHT = 230;
/** Where the mound's top sits at its edges and its crest. */
const EDGE = 96;
const CREST = 34;
const CYCLE_MS = 9000;

// Droplets: x as a fraction of the width, y above the crest line, radius.
// More to the right, as in the reference, as if flicked from a nib.
const DROPS: [number, number, number][] = [
  [0.08, 70, 1.4], [0.14, 58, 1], [0.22, 42, 1.8], [0.3, 30, 1.1], [0.38, 50, 0.9],
  [0.55, 22, 1.2], [0.62, 34, 2.2], [0.68, 16, 1.4], [0.73, 44, 1], [0.78, 26, 2.6],
  [0.82, 52, 1.2], [0.86, 36, 1.8], [0.9, 62, 1], [0.94, 44, 2], [0.97, 74, 1.3], [0.47, 60, 1]
];

function mound(width: number, phase: number): string {
  'worklet';
  const steps = 28;
  let d = `M0 ${HEIGHT} L0 ${EDGE}`;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * width;
    // A hill, flattened at the shoulders, with two slow ripples on top.
    const hill = Math.pow(Math.sin(Math.PI * t), 0.7);
    const ripple = Math.sin(t * 9 + phase) * 2.2 + Math.sin(t * 23 - phase * 1.3) * 0.9;
    const y = EDGE - (EDGE - CREST) * hill + ripple;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} L${width} ${HEIGHT} Z`;
}

function Drop({ width, fx, lift, r, index, phase, ink }: {
  width: number;
  fx: number;
  lift: number;
  r: number;
  index: number;
  phase: SharedValue<number>;
  ink: string;
}) {
  const props = useAnimatedProps(() => {
    const t = phase.value + index * 0.9;
    const base = EDGE - (EDGE - CREST) * Math.pow(Math.sin(Math.PI * fx), 0.7);
    return {
      cx: fx * width + Math.sin(t * 0.7) * 2.5,
      cy: base - lift + Math.sin(t) * 3.5
    };
  });
  return <AnimatedCircle animatedProps={props} r={r} fill={ink} />;
}

export function InkEnd({ link, onPress }: { link?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    if (motion === 'still') return;
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: motion === 'gentle' ? CYCLE_MS * 2 : CYCLE_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(phase);
  }, [motion, phase]);

  const top = useAnimatedProps(() => ({ d: mound(width, phase.value) }));

  return (
    <View style={styles.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AnimatedPath animatedProps={top} fill={colors.ink} />
          {DROPS.map(([fx, lift, r], i) => (
            <Drop key={i} width={width} fx={fx} lift={lift} r={r} index={i} phase={phase} ink={colors.ink} />
          ))}
        </Svg>
      )}
      <View style={styles.words}>
        <Text variant="title" style={{ color: colors.paper }}>
          The end
        </Text>
        {link && onPress && (
          <Pressable accessibilityRole="button" accessibilityLabel={link} onPress={onPress} hitSlop={8}>
            <Text variant="action" style={[styles.link, { color: colors.paper }]}>
              {link}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HEIGHT, marginHorizontal: -gutter, marginBottom: -space.xxl },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: EDGE + space.sm,
    alignItems: 'center',
    gap: space.md
  },
  link: { textDecorationLine: 'underline' }
});
