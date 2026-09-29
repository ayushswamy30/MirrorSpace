import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Box, SectionLabel } from '@/components/Blocks';
import { AppHeader } from '@/components/Header';
import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  dailyWeather,
  nightsSummary,
  tagTable,
  topWords,
  WEATHER_INK,
  type ChartDay,
  type NightsSummary,
  type TagRow,
  type WordCount
} from '@/lib/chart';
import { allCheckIns, onCheckInsChanged } from '@/lib/checkIns';
import { allSleep, formatDuration, onSleepChanged } from '@/lib/sleep';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { Weather } from '@/theme/tokens';

/**
 * Chart — from day 7 (DESIGN.md: "chart tables and boxed placements"): the
 * last thirty days as weather, the words reached for, what surrounds the
 * days, and nights. The person's own data, laid out; no reading written over
 * it. The Mind Chart (day 14) and Year in Weather are v1.
 */

type Data = { days: ChartDay[]; words: WordCount[]; tags: TagRow[]; nights: NightsSummary };

const WEATHERS: Weather[] = ['clear', 'mild', 'overcast', 'fog', 'storm'];

function useChart(): Data | null {
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(() => {
    Promise.all([allCheckIns(), allSleep()])
      .then(([checkIns, sleep]) => {
        const now = new Date();
        setData({
          days: dailyWeather(checkIns, now),
          words: topWords(checkIns, now),
          tags: tagTable(checkIns, now),
          nights: nightsSummary(sleep, now)
        });
      })
      .catch(err => console.warn('Chart unavailable:', err));
  }, []);

  useEffect(() => {
    load();
    const offCheckIns = onCheckInsChanged(load);
    const offSleep = onSleepChanged(load);
    return () => {
      offCheckIns();
      offSleep();
    };
  }, [load]);

  return data;
}

export default function Chart() {
  return (
    <Locked feature="patterns" promise="Your patterns, once there are enough days to see them.">
      <ChartPage />
    </Locked>
  );
}

function ChartPage() {
  const data = useChart();

  if (!data) return <Screen header={<AppHeader />}>{null}</Screen>;

  const { days, words, tags, nights } = data;

  return (
    <Screen header={<AppHeader />}>
      <SectionLabel title="your chart" rule={false} />
      <Text variant="reading">The last thirty days.</Text>

      <View style={styles.block}>
        <SectionLabel title="weather, day by day" />
        <WeatherGrid days={days} />
        <Legend />
      </View>

      {words.length > 0 && (
        <Box title="words you reach for">
          {words.map(w => (
            <TableRow key={w.word} left={w.word} right={`${w.count}×`} />
          ))}
        </Box>
      )}

      {tags.length > 0 && (
        <Box title="around your days">
          {tags.map(t => (
            <TableRow key={t.tag} left={t.tag} middle={`${t.count}×`} right={t.lean} />
          ))}
        </Box>
      )}

      <Box title="nights" centred>
        {nights ? (
          <>
            <Text variant="title">{formatDuration(nights.averageMinutes)}</Text>
            <Text variant="mono" tone="soft">
              {`average · ${nights.nights} nights · ${nights.shortNights} under 6h`}
            </Text>
          </>
        ) : (
          <Text tone="soft">No nights logged yet — Today has a line for last night.</Text>
        )}
      </Box>
    </Screen>
  );
}

function WeatherGrid({ days }: { days: ChartDay[] }) {
  const { colors } = useTheme();
  const counts = WEATHERS.map(w => `${days.filter(d => d.weather === w).length} ${w}`).join(', ');
  const empty = days.filter(d => !d.weather).length;

  return (
    <View style={styles.grid} accessible accessibilityLabel={`Last 30 days: ${counts}; ${empty} without a check-in.`}>
      {days.map(day => (
        <View key={day.date} style={styles.cell}>
          {day.weather ? (
            <View style={[styles.circle, { borderColor: colors.ink }]}>
              <View style={[styles.fill, { backgroundColor: colors.ink, opacity: WEATHER_INK[day.weather] }]} />
            </View>
          ) : (
            <View style={[styles.none, { backgroundColor: colors.inkFaint }]} />
          )}
        </View>
      ))}
    </View>
  );
}

function Legend() {
  const { colors } = useTheme();
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {WEATHERS.map(w => (
        <View key={w} style={styles.legendItem}>
          <View style={[styles.small, { borderColor: colors.ink }]}>
            <View style={[styles.fill, { backgroundColor: colors.ink, opacity: WEATHER_INK[w] }]} />
          </View>
          <Text variant="mono" tone="soft">
            {w}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TableRow({ left, middle, right }: { left: string; middle?: string; right: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tableRow, { borderBottomColor: colors.hairline }]}>
      <Text variant="heading" style={styles.flex}>
        {left}
      </Text>
      {middle && (
        <Text variant="mono" tone="soft" style={styles.middle}>
          {middle}
        </Text>
      )}
      <Text variant="mono" tone="soft">
        {right}
      </Text>
    </View>
  );
}

const CELL = 28;

const styles = StyleSheet.create({
  block: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  circle: { width: CELL - 4, height: CELL - 4, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  none: { width: 4, height: 4, borderRadius: radius.dot },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  small: { width: 12, height: 12, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  flex: { flex: 1 },
  middle: { minWidth: 36, textAlign: 'right' }
});
