import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useMotion } from '@/lib/preferences';

/**
 * The Void's night sky behind the Mirror room: a scatter of stars, each
 * twinkling on its own slow clock while the whole field drifts upward, so
 * the dark feels deep rather than empty. Still, when less motion is asked for.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const COUNT = 70;
const CYCLE_MS = 24000;

// A fixed field, the same on every visit — it's a place, not a screensaver.
function field(width: number, height: number) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: COUNT }, () => {
    const big = rand() > 0.9;
    return {
      x: rand() * width,
      y: rand() * height,
      r: big ? 1.1 + rand() * 0.8 : 0.35 + rand() * 0.6,
      base: 0.25 + rand() * 0.55,
      speed: 1 + Math.floor(rand() * 4),
      offset: rand() * Math.PI * 2
    };
  });
}

function Star({ star, phase, height }: { star: ReturnType<typeof field>[number]; phase: SharedValue<number>; height: number }) {
  const props = useAnimatedProps(() => {
    const t = phase.value;
    const twinkle = 0.55 + 0.45 * Math.sin(t * star.speed + star.offset);
    // One full, slow rise per cycle, wrapping at the top.
    const y = (star.y - (t / (Math.PI * 2)) * 40 * star.speed + height) % height;
    return { opacity: star.base * twinkle, cy: y };
  });
  return <AnimatedCircle animatedProps={props} cx={star.x} r={star.r} fill="#F2F2EF" />;
}

export function Starfield() {
  const motion = useMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const phase = useSharedValue(0);
  const stars = useMemo(() => (size.width ? field(size.width, size.height) : []), [size]);

  useEffect(() => {
    if (motion === 'still') return;
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: motion === 'gentle' ? CYCLE_MS * 2 : CYCLE_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(phase);
  }, [motion, phase]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          {stars.map((star, i) => (
            <Star key={i} star={star} phase={phase} height={size.height} />
          ))}
        </Svg>
      )}
    </View>
  );
}
