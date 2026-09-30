import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { WEATHER_INK } from '@/lib/chart';
import type { CircleFriend } from '@/lib/circle';
import { useMotion } from '@/lib/preferences';
import { gutter, MAX_WIDTH, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Avatar } from './Avatar';

/**
 * The circle, drawn as one: you in the middle, your friends on a ring that
 * turns very slowly — about once every two minutes — each carrying today's
 * weather as a small mark. Whoever is running low wears the page's one
 * colour, pulsing softly. Tap someone to open what you can do for them.
 */

const TURN_MS = 120_000;
const FRIEND = 46;

export function Orbit({
  me,
  friends,
  onSelect
}: {
  me: { name: string; icon: string | null };
  friends: CircleFriend[];
  onSelect: (id: string) => void;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const { width } = useWindowDimensions();
  const size = Math.min(width - gutter * 2, MAX_WIDTH - gutter * 2, 300);
  const mid = size / 2;
  const ring = mid - FRIEND / 2 - 6;
  const turn = useSharedValue(0);

  useEffect(() => {
    if (motion !== 'full' || friends.length === 0) return;
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [motion, friends.length, turn]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  // Each plate turns back as the ring turns, so faces stay upright.
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-turn.value}deg` }] }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={mid} cy={mid} r={ring} stroke={colors.inkSoft} strokeWidth={0.6} strokeDasharray="1 5" fill="none" />
        <Circle cx={mid} cy={mid} r={ring * 0.52} stroke={colors.inkSoft} strokeWidth={0.4} fill="none" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        {friends.map((f, i) => {
          const angle = (i / friends.length) * Math.PI * 2 - Math.PI / 2;
          const x = mid + ring * Math.cos(angle) - FRIEND / 2;
          const y = mid + ring * Math.sin(angle) - FRIEND / 2;
          return (
            <Animated.View key={f.id} style={[styles.friend, { left: x, top: y }, upright]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${f.name}${f.weather ? `, ${f.weather} today` : ''}${f.low ? ', running low' : ''}`}
                onPress={() => onSelect(f.id)}
                hitSlop={6}
              >
                <Avatar icon={f.icon} name={f.name} size={FRIEND} />
                <WeatherBadge weather={f.weather} />
                {f.low && <LowPulse />}
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

      <View style={[styles.me, { left: mid - 34, top: mid - 34 }]} accessible accessibilityLabel={`You, ${me.name}`}>
        <Avatar icon={me.icon} name={me.name} size={68} />
      </View>
    </View>
  );
}

function WeatherBadge({ weather }: { weather: CircleFriend['weather'] }) {
  const { colors } = useTheme();
  if (!weather) return null;
  return (
    <View style={[styles.badge, { borderColor: colors.ink, backgroundColor: colors.paper }]}>
      <View style={[styles.fill, { backgroundColor: colors.ink, opacity: WEATHER_INK[weather] }]} />
    </View>
  );
}

function LowPulse() {
  const { signal } = useTheme();
  const motion = useMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (motion === 'still') return;
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [motion, pulse]);

  const ring = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.5 }] }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.pulse, { borderColor: signal }, ring]} />
      <View pointerEvents="none" style={[styles.lowDot, { backgroundColor: signal }]} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  friend: { position: 'absolute', width: FRIEND, height: FRIEND },
  me: { position: 'absolute' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: radius.dot,
    borderWidth: 1,
    overflow: 'hidden'
  },
  fill: { flex: 1 },
  pulse: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: FRIEND + 8,
    height: FRIEND + 8,
    borderRadius: radius.dot,
    borderWidth: 1.5
  },
  lowDot: { position: 'absolute', left: -1, top: -1, width: 9, height: 9, borderRadius: radius.dot }
});
