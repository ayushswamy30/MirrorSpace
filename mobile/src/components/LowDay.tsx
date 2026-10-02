import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { AreaReading } from '@/lib/glance';
import { useMotion } from '@/lib/preferences';
import { useEntering } from '@/theme/motion';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Art, type ArtName } from './Art';
import { Lede } from './Blocks';
import { Button } from './Button';
import { Text } from './Text';

/**
 * The day by area: four quiet meters, five marks each, with the receipt under
 * every one. An area with nothing to go on shows no marks, and says why.
 */
export function Glance({ areas }: { areas: AreaReading[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {areas.map(a => (
        <View
          key={a.area}
          style={styles.area}
          accessible
          accessibilityLabel={`${a.label}: ${a.level ? `${a.level} of 5` : 'not enough yet'}. ${a.receipt}`}
        >
          <Text variant="label" tone="soft">
            {a.label}
          </Text>
          <View style={styles.meter}>
            {[1, 2, 3, 4, 5].map(i => (
              <View
                key={i}
                style={[
                  styles.mark,
                  { borderColor: a.level ? colors.ink : colors.inkFaint, backgroundColor: a.level && i <= a.level ? colors.ink : 'transparent' }
                ]}
              />
            ))}
          </View>
          <Text variant="caption" tone="soft">
            {a.receipt}
          </Text>
        </View>
      ))}
    </View>
  );
}

const CHOICES: { key: 'breathe' | 'check' | 'be'; title: string; hint: string; art: ArtName }[] = [
  { key: 'breathe', title: 'Breathe', hint: 'a minute, guided', art: 'swan' },
  { key: 'check', title: 'Check in', hint: 'one word is enough', art: 'lily' },
  { key: 'be', title: 'Just be here', hint: 'nothing to do', art: 'moka' }
];

/**
 * Low-day mode (report §7): when the last days have been heavy, Today asks
 * for nothing. Three gentle choices, help one tap away, and the full day
 * behind a link for whoever wants it.
 */
export function LowDay({ onShowDay }: { onShowDay: () => void }) {
  const { colors } = useTheme();
  const enter = useEntering();
  const [still, setStill] = useState(false);

  if (still) return <BeHere onBack={() => setStill(false)} />;

  return (
    <Animated.View entering={enter} style={styles.block}>
      <Lede label="today, gently" title="Just this, for now.">
        <Text tone="soft">The last few days have been heavy. Today doesn’t need anything from you.</Text>
      </Lede>
      <View style={styles.choices}>
        {CHOICES.map(c => (
          <Pressable
            key={c.key}
            accessibilityRole="button"
            accessibilityLabel={`${c.title}: ${c.hint}`}
            onPress={() => {
              if (c.key === 'breathe') router.push('/calm');
              else if (c.key === 'check') router.navigate('/check-in');
              else setStill(true);
            }}
            style={({ pressed }) => [styles.choice, { borderColor: colors.hairline, backgroundColor: pressed ? colors.band : 'transparent' }]}
          >
            <Art name={c.art} size={44} />
            <View style={styles.flex}>
              <Text variant="heading">{c.title}</Text>
              <Text variant="mono" tone="soft">
                {c.hint}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.links}>
        <Button kind="link" label="need help now" onPress={() => router.push('/help')} />
        <Button kind="link" label="show the whole day" onPress={onShowDay} />
      </View>
    </Animated.View>
  );
}

/** A circle that breathes, slowly, and words that ask for nothing. */
function BeHere({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (motion === 'still') return;
    breath.value = withRepeat(withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [motion, breath]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + breath.value * 0.3 }], opacity: 0.35 + breath.value * 0.4 }));

  return (
    <View style={styles.be}>
      <Animated.View style={[styles.circle, { borderColor: colors.ink }, circle]} />
      <Text variant="title" style={styles.centre}>
        You don’t have to do anything.
      </Text>
      <Text tone="soft" style={styles.centre}>
        Stay as long as you like.
      </Text>
      <Button kind="link" label="back" onPress={onBack} style={styles.centred} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, columnGap: space.md },
  area: { width: '47%', gap: space.xs + 2 },
  meter: { flexDirection: 'row', gap: 4 },
  mark: { width: 14, height: 14, borderWidth: 1 },
  block: { gap: space.lg },
  choices: { gap: space.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hitTarget + 24,
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth
  },
  flex: { flex: 1, gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  be: { alignItems: 'center', gap: space.lg, paddingTop: space.xl },
  circle: { width: 200, height: 200, borderRadius: radius.dot, borderWidth: 1, marginBottom: space.lg },
  centre: { textAlign: 'center' },
  centred: { alignSelf: 'center' }
});
