import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

import { localDate } from '@/lib/checkIns';
import { WEATHER_INK } from '@/lib/chart';
import { useMotion } from '@/lib/preferences';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { Weather } from '@/theme/tokens';

import { Art, ArtDisc, type ArtName } from './Art';
import { Icon } from './icons';
import { Text } from './Text';

/**
 * Today's own pieces, after the reference's home: the "TODAY ⌄" control, the
 * week strip it opens, the picture plate, and a weather mark that breathes.
 */

export function sameDay(a: Date, b: Date): boolean {
  return localDate(a) === localDate(b);
}

/** "TODAY ⌄" in the header — or the day being looked at, when it isn't today. */
export function DateControl({ date, open, onPress }: { date: Date; open: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const label = sameDay(date, new Date())
    ? 'today'
    : date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${open ? 'Hide' : 'Show'} the week`}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.control, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text variant="label">{label}</Text>
      <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
        <Icon name="arrow" color={colors.ink} size={11} />
      </View>
    </Pressable>
  );
}

type StripProps = {
  days: Date[];
  selected: Date;
  marks: (Weather | null)[];
  onSelect: (day: Date) => void;
  onWeek: (direction: -1 | 1) => void;
  /** No stepping into weeks that haven't happened. */
  canGoForward: boolean;
};

/** The reference's week: day letters, dates, the chosen one in an ink circle. */
export function WeekStrip({ days, selected, marks, onSelect, onWeek, canGoForward }: StripProps) {
  const { colors } = useTheme();
  const now = new Date();

  return (
    <View style={styles.strip}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => onWeek(-1)} hitSlop={8} style={styles.stepper}>
        <Icon name="back" color={colors.ink} size={16} />
      </Pressable>
      {days.map((day, i) => {
        const chosen = sameDay(day, selected);
        const future = day.getTime() > now.getTime() && !sameDay(day, now);
        const isToday = sameDay(day, now);
        const weather = marks[i];
        return (
          <Pressable
            key={localDate(day)}
            accessibilityRole="button"
            accessibilityLabel={day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            accessibilityState={{ selected: chosen, disabled: future }}
            disabled={future}
            onPress={() => onSelect(day)}
            style={styles.day}
          >
            <Text variant="label" style={[styles.letter, { color: isToday ? colors.ink : colors.inkSoft }]}>
              {isToday ? 'today' : day.toLocaleDateString([], { weekday: 'short' }).slice(0, 3)}
            </Text>
            <View style={[styles.date, chosen && { backgroundColor: colors.ink }]}>
              <Text variant="mono" style={{ color: chosen ? colors.paper : future ? colors.inkFaint : colors.ink }}>
                {day.getDate()}
              </Text>
            </View>
            {/* A day with a check-in carries a small mark in its weather's ink. */}
            <View style={[styles.mark, { borderColor: weather ? colors.ink : 'transparent' }]}>
              {weather && <View style={[styles.fill, { backgroundColor: colors.ink, opacity: WEATHER_INK[weather] }]} />}
            </View>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next week"
        accessibilityState={{ disabled: !canGoForward }}
        disabled={!canGoForward}
        onPress={() => onWeek(1)}
        hitSlop={8}
        style={[styles.stepper, { opacity: canGoForward ? 1 : 0.25 }]}
      >
        <Icon name="arrow" color={colors.ink} size={16} />
      </Pressable>
    </View>
  );
}

/** The picture plate, drifting a few points up and down as if on water. */
export function FloatingDisc({ name, size }: { name: ArtName; size: number }) {
  const motion = useMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (motion === 'still') return;
    drift.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(drift);
  }, [motion, drift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * drift.value }, { rotate: `${drift.value * 3 - 1.5}deg` }] }));

  return (
    <Animated.View style={style}>
      <ArtDisc name={name} size={size} />
    </Animated.View>
  );
}

/** The weather's one colour, with a slow ring breathing out from it. */
export function WeatherMark({ color, size = 14 }: { color: string; size?: number }) {
  const motion = useMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (motion === 'still') return;
    breath.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(breath);
  }, [motion, breath]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - breath.value),
    transform: [{ scale: 1 + breath.value * 1.4 }]
  }));

  return (
    <View style={{ width: size * 2.6, height: size * 2.6, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.ring, { width: size, height: size, borderColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: radius.dot, backgroundColor: color }} />
    </View>
  );
}

/** The reference's margin motif: a cut-out, and a hairline running from it. */
export function ArtRule({ name, size = 110, side = 'left' }: { name: ArtName; size?: number; side?: 'left' | 'right' }) {
  const { colors } = useTheme();
  const rule = <View style={[styles.rule, { backgroundColor: colors.inkSoft }]} />;
  return (
    <View style={styles.artRule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {side === 'right' && rule}
      <Art name={name} size={size} />
      {side === 'left' && rule}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: hitTarget },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  stepper: { width: 24, height: hitTarget, alignItems: 'center', justifyContent: 'center' },
  day: { alignItems: 'center', gap: space.xs + 2, minWidth: 36, paddingVertical: space.xs },
  letter: { fontSize: 9, letterSpacing: 1 },
  date: { width: 30, height: 30, borderRadius: radius.dot, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 7, height: 7, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  ring: { position: 'absolute', borderRadius: radius.dot, borderWidth: 1.5 },
  artRule: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth }
});
