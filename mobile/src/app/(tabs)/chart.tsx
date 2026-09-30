import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Art } from '@/components/Art';
import { Box, Lede, Section } from '@/components/Blocks';
import { AppHeader } from '@/components/Header';
import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  dailyWeather,
  mostlyWeather,
  nightly,
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
import { gutter, MAX_WIDTH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { Weather } from '@/theme/tokens';

/**
 * Chart — from day 7 (DESIGN.md: "chart tables and boxed placements"): the
 * last thirty days drawn as a wheel of weather, the words reached for set
 * like type, what surrounds the days, and a skyline of nights. The person's
 * own data, laid out; no reading written over it. Monochrome, with the one
 * signal mark on today. The Mind Chart (day 14) and Year in Weather are v1.
 */

type Data = {
  days: ChartDay[];
  words: WordCount[];
  tags: TagRow[];
  nights: NightsSummary;
  perNight: (number | null)[];
};

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
          nights: nightsSummary(sleep, now),
          perNight: nightly(sleep, now)
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

  const { days, words, tags, nights, perNight } = data;
  const mostly = mostlyWeather(days);
  const checkedIn = days.filter(d => d.weather).length;

  return (
    <Screen header={<AppHeader />}>
      <Lede label="your chart" title="The last thirty days.">
        <Text tone="soft">
          {mostly
            ? `Mostly ${mostly.weather} — ${mostly.days} of the ${checkedIn} days you checked in.`
            : 'Your weather fills in here, one check-in at a time.'}
        </Text>
      </Lede>

      <Section title="weather, day by day">
        <Wheel days={days} centre={mostly?.weather ?? null} />
        <Legend />
      </Section>

      <Art name="beetle" size={128} style={styles.margin} />

      {words.length > 0 && (
        <Box title="words you reach for" centred>
          <Words words={words} />
        </Box>
      )}

      {tags.length > 0 && (
        <Box title="around your days">
          {tags.map(t => (
            <TagLine key={t.tag} row={t} max={tags[0].count} />
          ))}
        </Box>
      )}

      <Section title="nights">
        {nights ? (
          <>
            <View style={styles.nightsHead}>
              <Text variant="title">{formatDuration(nights.averageMinutes)}</Text>
              <Text variant="mono" tone="soft">
                {`average · ${nights.nights} nights · ${nights.shortNights} under 6h`}
              </Text>
            </View>
            <Skyline nights={perNight} />
          </>
        ) : (
          <Text tone="soft">No nights logged yet — Today has a line for last night.</Text>
        )}
      </Section>
    </Screen>
  );
}

/**
 * The month as a wheel, after the reference's chart: thirty days around a
 * ring, clockwise from the top, oldest first. Each day is a circle filled by
 * its weather's ink; a day without a check-in is a speck. Today carries the
 * one signal mark, just outside the ring.
 */
function Wheel({ days, centre }: { days: ChartDay[]; centre: Weather | null }) {
  const { colors, signal } = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(width - gutter * 2, MAX_WIDTH - gutter * 2, 320);
  const mid = size / 2;
  const ring = mid - 24;
  const dot = Math.max(4, Math.min(8, (Math.PI * ring) / days.length - 2));
  const at = (i: number, r: number) => {
    const angle = ((i + 0.5) / days.length) * Math.PI * 2 - Math.PI / 2;
    return { x: mid + r * Math.cos(angle), y: mid + r * Math.sin(angle) };
  };

  const counts = WEATHERS.map(w => `${days.filter(d => d.weather === w).length} ${w}`).join(', ');
  const empty = days.filter(d => !d.weather).length;
  const today = at(days.length - 1, ring + dot + 8);

  return (
    <View
      style={[styles.wheel, { width: size, height: size }]}
      accessible
      accessibilityLabel={`Last 30 days: ${counts}; ${empty} without a check-in.`}
    >
      <Svg width={size} height={size}>
        <Circle cx={mid} cy={mid} r={ring - dot - 10} stroke={colors.ink} strokeWidth={0.5} fill="none" />
        <Circle cx={mid} cy={mid} r={ring + dot + 14} stroke={colors.ink} strokeWidth={0.5} fill="none" />
        {/* Where the month begins and ends. */}
        <Line
          x1={mid}
          y1={mid - ring - dot - 14}
          x2={mid}
          y2={mid - ring + dot + 10}
          stroke={colors.ink}
          strokeWidth={0.5}
        />
        {days.map((day, i) => {
          const { x, y } = at(i, ring);
          return day.weather ? (
            <Circle
              key={day.date}
              cx={x}
              cy={y}
              r={dot}
              stroke={colors.ink}
              strokeWidth={1}
              fill={colors.ink}
              fillOpacity={WEATHER_INK[day.weather]}
            />
          ) : (
            <Circle key={day.date} cx={x} cy={y} r={1.5} fill={colors.inkSoft} />
          );
        })}
        <Circle cx={today.x} cy={today.y} r={3} fill={signal} />
      </Svg>
      <View style={styles.wheelCentre} pointerEvents="none">
        <Text variant="mono" tone="soft">
          {centre ? 'mostly' : 'no weather yet'}
        </Text>
        {centre && <Text variant="title">{centre}</Text>}
      </View>
    </View>
  );
}

function Legend() {
  const { colors } = useTheme();
  return (
    <View style={styles.legendWrap}>
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
      <Text variant="mono" tone="soft" style={styles.centreText}>
        Clockwise from the top: thirty days ago, round to today’s coloured mark.
      </Text>
    </View>
  );
}

/** The words, set like type: the more often reached for, the larger. */
function Words({ words }: { words: WordCount[] }) {
  const max = words[0]?.count ?? 1;
  return (
    <View style={styles.words}>
      {words.map(w => {
        const fontSize = 20 + Math.round((w.count / max) * 18);
        return (
          <View key={w.word} style={styles.word}>
            <Text variant="heading" style={{ fontSize, lineHeight: Math.round(fontSize * 1.15) }}>
              {w.word}
            </Text>
            <Text variant="mono" tone="soft">{`${w.count}×`}</Text>
          </View>
        );
      })}
    </View>
  );
}

const LEAN: Record<TagRow['lean'], string> = { lighter: '↑ lighter', heavier: '↓ heavier', even: '· even' };

/**
 * One tag: its name, a rule as long as its count, and which way its days
 * lean. The rules themselves separate the lines; no dividers between them.
 */
function TagLine({ row, max }: { row: TagRow; max: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.tagLine}
      accessible
      accessibilityLabel={`${row.tag}: ${row.count} days, ${row.lean}`}
    >
      <View style={styles.tagTop}>
        <Text variant="heading" style={styles.flex}>
          {row.tag}
        </Text>
        <Text variant="mono" tone="soft">
          {`${row.count}×  ${LEAN[row.lean]}`}
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: colors.ink, width: `${Math.max(6, (row.count / max) * 100)}%` }]} />
    </View>
  );
}

const EIGHT_HOURS = 8 * 60;
const SKY_TOP = 11 * 60;

/**
 * Thirty nights as a skyline: one thin line per night, as tall as the sleep,
 * against a dotted rule at eight hours. A night not logged is a speck.
 */
function Skyline({ nights }: { nights: (number | null)[] }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const h = 88;
  const step = w / nights.length;
  const y = (minutes: number) => h - (Math.min(minutes, SKY_TOP) / SKY_TOP) * h;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.skyline}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      <Svg width={w} height={h + 1}>
        <Line
          x1={0}
          y1={y(EIGHT_HOURS)}
          x2={w}
          y2={y(EIGHT_HOURS)}
          stroke={colors.inkSoft}
          strokeWidth={0.75}
          strokeDasharray="2 3"
        />
        <Line x1={0} y1={h} x2={w} y2={h} stroke={colors.ink} strokeWidth={0.5} />
        {nights.map((m, i) => {
          const x = i * step + step / 2;
          return m === null ? (
            <Circle key={i} cx={x} cy={h - 2} r={1} fill={colors.inkSoft} />
          ) : (
            <Line key={i} x1={x} y1={h} x2={x} y2={y(m)} stroke={colors.ink} strokeWidth={Math.max(1.5, step * 0.35)} />
          );
        })}
      </Svg>
      <View style={styles.skyLabels}>
        <Text variant="mono" tone="soft">
          30 nights ago
        </Text>
        <Text variant="mono" tone="soft">
          ┄ 8h
        </Text>
        <Text variant="mono" tone="soft">
          last night
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { alignSelf: 'center', marginTop: space.md },
  wheelCentre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  legendWrap: { gap: space.sm, alignItems: 'center', marginTop: space.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  small: { width: 12, height: 12, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  centreText: { textAlign: 'center' },
  margin: { alignSelf: 'flex-end', marginVertical: -space.md },
  words: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: space.lg,
    rowGap: space.sm,
    paddingVertical: space.sm
  },
  word: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  tagLine: { paddingVertical: space.sm + 2, gap: space.xs + 2 },
  tagTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  flex: { flex: 1 },
  bar: { height: 1.5 },
  nightsHead: { gap: 2, paddingTop: space.sm },
  skyline: { gap: space.xs, marginTop: space.md },
  skyLabels: { flexDirection: 'row', justifyContent: 'space-between' }
});
