import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Art, ArtDisc, artOfTheDay } from '@/components/Art';
import { DoDont, EndMark, Lede, Row, Section } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { AppHeader, shortDate } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { clockOf, formatClock, formatDuration } from '@/lib/sleep';
import { useToday } from '@/lib/useToday';
import { useEntering } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Today — "your day at a glance" (DESIGN.md), laid out like the reference's
 * home: the day's picture in a disc at the top right, air, then the reading,
 * Do/Don't and one action. Below: last night, what the reading was built
 * from, the Inner Weather, and an end. Everything is computed on the phone.
 */
export default function Today() {
  const data = useToday();
  const { signal } = useTheme();
  const first = useEntering();
  const second = useEntering(150);

  if (!data) return <Screen header={<AppHeader />}>{null}</Screen>;

  const { reading, facts, weather, checkedInToday, lastNight } = data;
  const receipts = facts.slice(0, 3);

  return (
    <Screen header={<AppHeader />}>
      <View style={styles.hero}>
        <ArtDisc name={artOfTheDay()} size={104} />
      </View>

      <Animated.View entering={first} style={styles.block}>
        <Lede label={`your day at a glance · ${shortDate()}`} title={reading.headline}>
          <Text>{reading.subtext}</Text>
        </Lede>
      </Animated.View>

      <Animated.View entering={second} style={styles.block}>
        <DoDont dos={reading.dos} donts={reading.donts} />
        {!checkedInToday && (
          <Button label="check in" arrow onPress={() => router.navigate('/check-in')} style={styles.cta} />
        )}
      </Animated.View>

      <Section title="last night">
        {lastNight ? (
          <Row
            title={formatDuration(lastNight.minutes)}
            subtitle={`${formatClock(clockOf(lastNight.bedAt))} – ${formatClock(clockOf(lastNight.wakeAt))}${
              lastNight.source === 'health' ? ' · from Health Connect' : ''
            }`}
            onPress={() => router.push('/sleep')}
            accessibilityHint="Change last night"
          />
        ) : (
          <Row title="How did you sleep?" subtitle="two times, by hand" onPress={() => router.push('/sleep')} />
        )}
      </Section>

      {receipts.length > 0 && (
        <Section title="behind this reading">
          {receipts.map(fact => (
            <Row key={fact.key} title={fact.text} subtitle={fact.receipt} />
          ))}
        </Section>
      )}

      <Art name="masks" size={150} style={styles.margin} />

      {weather && (
        <Section title="inner weather">
          <View style={styles.weather}>
            <View style={[styles.dot, { backgroundColor: signal }]} />
            <Text variant="title">{weather}</Text>
          </View>
          <Text variant="caption" tone="soft">
            From your check-ins over the last three days. It sets the one colour you see around the app.
          </Text>
        </Section>
      )}

      {!weather && facts.length === 0 && (
        <Text tone="soft">Your reading becomes yours after a few check-ins. One word a day is enough.</Text>
      )}

      <EndMark link="write something down" onPress={() => router.navigate('/check-in?mode=vent')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The reference's opening: the picture high on the right, then a long pause.
  hero: { alignItems: 'flex-end', paddingTop: space.sm, paddingBottom: space.xl },
  block: { gap: space.lg },
  cta: { marginTop: space.sm },
  margin: { alignSelf: 'flex-start', marginVertical: -space.sm },
  weather: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  dot: { width: 14, height: 14, borderRadius: radius.dot }
});
