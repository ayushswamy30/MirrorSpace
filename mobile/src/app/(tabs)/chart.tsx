import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { Art } from '@/components/Art';
import { Box, Lede, Section } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { AppHeader } from '@/components/Header';
import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { MonthCard, ShareButton } from '@/components/ShareCard';
import { Text } from '@/components/Text';
import {
  dailyWeather,
  mostlyWeather,
  nightly,
  nightsSummary,
  tagTable,
  topWords,
  WEATHER_INK,
  yearInWeather,
  type ChartDay,
  type NightsSummary,
  type TagRow,
  type WordCount,
  type YearMonth
} from '@/lib/chart';
import { allCheckIns, onCheckInsChanged } from '@/lib/checkIns';
import { config } from '@/lib/config';
import { useMotion } from '@/lib/preferences';
import { useProfile } from '@/lib/session';
import { allSleep, formatDuration, onSleepChanged } from '@/lib/sleep';
import { daysUntil, isUnlocked, type Feature } from '@/lib/unlocks';
import { gutter, MAX_WIDTH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { Weather } from '@/theme/tokens';

/**
 * Chart — from day 7 (DESIGN.md: "chart tables and boxed placements"): the
 * last thirty days drawn as a wheel of weather, the words reached for set
 * like type, what surrounds the days, and a skyline of nights. The person's
 * own data, laid out; no reading written over it. Monochrome, with the one
 * signal mark on today, and the year as a mosaic. The Mind Chart (day 14)
 * and Wrapped (day 30) are their own pages, linked at the top.
 */

type Data = {
  days: ChartDay[];
  words: WordCount[];
  tags: TagRow[];
  nights: NightsSummary;
  perNight: (number | null)[];
  /** The words chosen each day, for the wheel's middle. */
  wordsOn: Record<string, string[]>;
  year: YearMonth[];
};

const WEATHERS: Weather[] = ['clear', 'mild', 'overcast', 'fog', 'storm'];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
          perNight: nightly(sleep, now),
          year: yearInWeather(checkIns, now),
          wordsOn: checkIns.reduce<Record<string, string[]>>((acc, c) => {
            (acc[c.localDate] ??= []).push(c.emotion);
            return acc;
          }, {})
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

  if (!data) return <Screen scene="weather" header={<AppHeader />}>{null}</Screen>;

  const { days, words, tags, nights, perNight, wordsOn, year } = data;
  const mostly = mostlyWeather(days);
  const checkedIn = days.filter(d => d.weather).length;

  return (
    <Screen scene="weather" header={<AppHeader />}>
      <View style={styles.links}>
        <Button kind="link" label="this week, in reflection" onPress={() => router.push('/week')} />
        <UnlockLink feature="mindChart" label="your mind chart" name="Your mind chart" href="/mind" />
        <UnlockLink feature="wrapped" label="wrapped" name="Wrapped" href="/wrapped" />
        <Button kind="link" label="experiments" onPress={() => router.push('/experiments')} />
      </View>
      <Lede label="your chart" title="The last thirty days.">
        <Text tone="soft">
          {mostly
            ? `Mostly ${mostly.weather} — ${mostly.days} of the ${checkedIn} days you checked in.`
            : 'Your weather fills in here, one check-in at a time.'}
        </Text>
      </Lede>

      <Section title="weather, day by day">
        <Wheel days={days} centre={mostly?.weather ?? null} wordsOn={wordsOn} />
        <Legend />
        <ShareButton label="share the month" card={<MonthCard days={days} mostly={mostly?.weather ?? null} />} />
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

      <Section title="year in weather">
        <YearMosaic months={year} />
      </Section>
    </Screen>
  );
}

/** A page that opens on a later day; until then, a quiet line about when. */
function UnlockLink({ feature, label, name, href }: { feature: Feature; label: string; name: string; href: '/mind' | '/wrapped' }) {
  const profile = useProfile();
  const createdAt = new Date(profile.createdAt);

  if (isUnlocked(feature, createdAt, new Date(), config.unlockAll)) {
    return <Button kind="link" label={label} onPress={() => router.push(href)} />;
  }
  const days = daysUntil(feature, createdAt);
  return (
    <Text variant="mono" tone="soft">
      {days === 1 ? `${name} opens tomorrow.` : `${name} opens in ${days} days.`}
    </Text>
  );
}

/**
 * The month as a wheel, after the reference's chart: thirty days around a
 * ring, clockwise from the top, oldest first. Each day is a circle filled by
 * its weather's ink; a day without a check-in is a speck. Today carries the
 * one signal mark, just outside the ring.
 */
function Wheel({ days, centre, wordsOn }: { days: ChartDay[]; centre: Weather | null; wordsOn: Record<string, string[]> }) {
  const { colors, signal } = useTheme();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState<number | null>(null);
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
  const day = picked === null ? null : days[picked];

  return (
    <View
      style={[styles.wheel, { width: size, height: size }]}
      accessible
      accessibilityLabel={`Last 30 days: ${counts}; ${empty} without a check-in.`}
      accessibilityHint="Tap a day on the ring to see it in the middle"
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
        {days.map((d, i) => {
          const { x, y } = at(i, ring);
          return (
            <DayDot
              key={d.date}
              index={i}
              x={x}
              y={y}
              r={d.weather ? dot : 1.5}
              weather={d.weather}
              picked={picked === i}
              onPress={() => setPicked(p => (p === i ? null : i))}
            />
          );
        })}
        <TodayMark x={today.x} y={today.y} color={signal} />
      </Svg>
      <View style={styles.wheelCentre} pointerEvents="none">
        {day ? (
          <>
            <Text variant="mono" tone="soft">
              {new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Text variant="title">{day.weather ?? 'quiet'}</Text>
            <Text variant="mono" tone="soft" style={styles.centreText}>
              {(wordsOn[day.date] ?? []).slice(0, 3).join(' · ') || 'no check-in'}
            </Text>
          </>
        ) : (
          <>
            <Text variant="mono" tone="soft">
              {centre ? 'mostly' : 'no weather yet'}
            </Text>
            {centre && <Text variant="title">{centre}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

/**
 * One day on the ring. The days ripple in one after another, clockwise from
 * the top, the first time the page opens; a tapped day is ruled round.
 */
function DayDot({
  index,
  x,
  y,
  r,
  weather,
  picked,
  onPress
}: {
  index: number;
  x: number;
  y: number;
  r: number;
  weather: Weather | null;
  picked: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const shown = useSharedValue(motion === 'still' ? 1 : 0);

  useEffect(() => {
    if (motion === 'still') return;
    shown.value = withDelay(index * 28, withTiming(1, { duration: 520, easing: Easing.out(Easing.back(2)) }));
  }, [index, motion, shown]);

  const body = useAnimatedProps(() => ({ r: r * shown.value }));

  return (
    <>
      {picked && <Circle cx={x} cy={y} r={r + 5} stroke={colors.ink} strokeWidth={1} fill="none" />}
      {weather ? (
        <AnimatedCircle
          animatedProps={body}
          cx={x}
          cy={y}
          stroke={colors.ink}
          strokeWidth={1}
          fill={colors.ink}
          fillOpacity={WEATHER_INK[weather]}
        />
      ) : (
        <AnimatedCircle animatedProps={body} cx={x} cy={y} fill={colors.inkSoft} />
      )}
      {/* A larger, invisible target: the dots are small, fingers aren't. */}
      <Circle cx={x} cy={y} r={Math.max(r, 4) + 7} fill="transparent" onPress={onPress} />
    </>
  );
}

/** Today's signal mark, with a slow ring going out from it. */
function TodayMark({ x, y, color }: { x: number; y: number; color: string }) {
  const motion = useMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (motion === 'still') return;
    pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [motion, pulse]);

  const ring = useAnimatedProps(() => ({ r: 3 + pulse.value * 7, strokeOpacity: 0.6 * (1 - pulse.value) }));

  return (
    <>
      <AnimatedCircle animatedProps={ring} cx={x} cy={y} stroke={color} strokeWidth={1} fill="none" />
      <Circle cx={x} cy={y} r={3} fill={color} />
    </>
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
        Clockwise from the top: thirty days ago, round to today’s coloured mark. Tap a day to see it.
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

/**
 * The year as a mosaic: a row per month, a square per day, filled by its
 * weather's ink. A quiet day is a speck; days still to come are left blank.
 */
function YearMosaic({ months }: { months: YearMonth[] }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const label = 30;
  const cell = w > label ? (w - label) / 31 : 0;
  const square = Math.max(2, cell - 2);
  const known = months.flatMap(m => m.days).filter(d => d.weather);
  const counts = WEATHERS.map(x => `${known.filter(d => d.weather === x).length} ${x}`).join(', ');

  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={styles.year}
      accessible
      accessibilityLabel={`Year in weather, ${months.length} ${months.length === 1 ? 'month' : 'months'}: ${counts}.`}
    >
      {cell > 0 &&
        months.map(m => (
          <View key={m.month} style={styles.yearRow}>
            <Text variant="mono" tone="soft" style={{ width: label }}>
              {new Date(`${m.month}-15T12:00:00`).toLocaleDateString([], { month: 'short' }).slice(0, 3).toLowerCase()}
            </Text>
            <Svg width={cell * 31} height={cell}>
              {m.days.map((d, i) =>
                d.ahead ? null : d.weather ? (
                  <Rect
                    key={d.date}
                    x={i * cell + 1}
                    y={1}
                    width={square}
                    height={square}
                    stroke={colors.ink}
                    strokeWidth={0.75}
                    fill={colors.ink}
                    fillOpacity={WEATHER_INK[d.weather]}
                  />
                ) : (
                  <Circle key={d.date} cx={i * cell + cell / 2} cy={cell / 2} r={0.9} fill={colors.inkSoft} />
                )
              )}
            </Svg>
          </View>
        ))}
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
  links: { gap: space.sm, alignItems: 'flex-start' },
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
  skyLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  year: { gap: 2, marginTop: space.sm },
  yearRow: { flexDirection: 'row', alignItems: 'center' }
});
