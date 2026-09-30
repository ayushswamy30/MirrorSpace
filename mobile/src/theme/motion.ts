import { Platform } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

/**
 * Transitions ease like breathing — 600–900 ms, nothing bounces. With the
 * system's reduced-motion setting on, movement is replaced by a plain fade
 * rather than removed, so state changes stay perceivable.
 */
export const duration = {
  settle: 600,
  breathe: 900
} as const;

/** Sine in-out: symmetric, no overshoot. */
export const breathEasing = Easing.bezier(0.37, 0, 0.63, 1);

export function useEntering(delay = 0) {
  const reduced = useReducedMotion();
  // On web, Reanimated leaves an entering view absolutely positioned, so it
  // lands on top of what follows. The browser preview simply doesn't animate.
  if (Platform.OS === 'web') return undefined;
  if (reduced) {
    return FadeIn.duration(duration.settle).delay(delay);
  }
  return FadeInDown.duration(duration.breathe).delay(delay).easing(breathEasing).withInitialValues({
    transform: [{ translateY: 8 }]
  });
}

export const exiting = FadeOut.duration(duration.settle);
