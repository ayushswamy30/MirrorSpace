import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DoDont, EndMark, Row, SectionLabel } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { AppHeader, shortDate } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToday } from '@/lib/useToday';
import { useEntering } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Today — "your day at a glance" (DESIGN.md): the reading, Do/Don't, what it
 * was built from, the Inner Weather, and an end. Everything is computed on
 * the phone from check-ins; sleep joins when health data does.
 */
export default function Today() {
  const data = useToday();
  const { signal } = useTheme();
  const first = useEntering();
  const second = useEntering(150);

  if (!data) return <Screen header={<AppHeader />}>{null}</Screen>;

  const { reading, facts, weather, checkedInToday } = data;
  const receipts = facts.slice(0, 3);

  return (
    <Screen header={<AppHeader />}>
      <Animated.View entering={first} style={styles.block}>
        <SectionLabel title={`your day at a glance · ${shortDate()}`} rule={false} />
        <Text variant="reading">{reading.headline}</Text>
        <Text>{reading.subtext}</Text>
      </Animated.View>

      <Animated.View entering={second} style={styles.block}>
        <DoDont dos={reading.dos} donts={reading.donts} />
        {!checkedInToday && (
          <Button label="check in" arrow onPress={() => router.navigate('/check-in')} style={styles.cta} />
        )}
      </Animated.View>

      {receipts.length > 0 && (
        <View>
          <SectionLabel title="behind this reading" />
          {receipts.map(fact => (
            <Row key={fact.key} title={fact.text} subtitle={fact.receipt} />
          ))}
        </View>
      )}

      {weather && (
        <View style={styles.block}>
          <SectionLabel title="inner weather" />
          <View style={styles.weather}>
            <View style={[styles.dot, { backgroundColor: signal }]} />
            <Text variant="title">{weather}</Text>
          </View>
          <Text variant="caption" tone="soft">
            From your check-ins over the last three days. It sets the one colour you see around the app.
          </Text>
        </View>
      )}

      {!weather && facts.length === 0 && (
        <Text tone="soft">Your reading becomes yours after a few check-ins. One word a day is enough.</Text>
      )}

      <EndMark link="write something down" onPress={() => router.navigate('/check-in?mode=vent')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  cta: { marginTop: space.sm },
  weather: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 14, height: 14, borderRadius: radius.dot }
});
