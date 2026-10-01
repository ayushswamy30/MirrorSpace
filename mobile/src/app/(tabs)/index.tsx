import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { artOfTheDay } from '@/components/Art';
import { DoDont, EndMark, Lede, Row, Section } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { AppHeader, shortDate } from '@/components/Header';
import { Loader } from '@/components/Loader';
import { Glance, LowDay } from '@/components/LowDay';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ArtRule, DateControl, FloatingDisc, WeatherMark, WeekStrip, sameDay } from '@/components/TodayParts';
import { addDays, startOfDay, useDayRecord, useDays, weekMarks, weekOf, type DayRecord } from '@/lib/days';
import { glance, isLowDay, type AreaReading } from '@/lib/glance';
import { usePreferences } from '@/lib/preferences';
import { clockOf, formatClock, formatDuration } from '@/lib/sleep';
import { useToday } from '@/lib/useToday';
import { isWeekEnd } from '@/lib/week';
import { firstLine } from '@/lib/vents';
import { useEntering } from '@/theme/motion';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Today — "your day at a glance" (DESIGN.md), laid out like the reference's
 * home: the day's picture floating in a disc at the top right, air, then the
 * reading, Do/Don't and one action; last night, what the reading was built
 * from, the Inner Weather breathing, and the ink the page ends in.
 *
 * "TODAY ⌄" opens the week: any earlier day shows as it stood that evening —
 * its reading, its check-ins and notes, its night and the pages kept.
 */
export default function Today() {
  const data = useToday();
  const days = useDays();
  const { weekStart } = usePreferences();
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [open, setOpen] = useState(false);
  // Low-day mode stays out of the way once the person asks for the whole day.
  const [wholeDay, setWholeDay] = useState(false);
  const { lowDay: lowDayMode } = usePreferences();
  const record = useDayRecord(selected, days);
  const content = useEntering();

  const week = weekOf(selected, weekStart);
  const isToday = sameDay(selected, new Date());
  const header = (
    <AppHeader extra={<DateControl date={selected} open={open} onPress={() => setOpen(o => !o)} />} />
  );

  if (!data) {
    return (
      <Screen header={header} scroll={false}>
        <Loader fill label="Reading your day" />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      {open && (
        <WeekStrip
          days={week}
          selected={selected}
          marks={days ? weekMarks(week, days.checkIns) : week.map(() => null)}
          onSelect={day => setSelected(day)}
          onWeek={direction => setSelected(d => {
            const next = addDays(d, 7 * direction);
            return next.getTime() > Date.now() ? startOfDay(new Date()) : next;
          })}
          canGoForward={!week.some(d => sameDay(d, new Date()))}
        />
      )}

      {/* A new day fades in, rather than snapping. */}
      <Animated.View key={selected.toDateString()} entering={content} style={styles.page}>
        {isToday ? (
          lowDayMode && !wholeDay && days && isLowDay(days.checkIns) ? (
            <LowDay onShowDay={() => setWholeDay(true)} />
          ) : (
            <TodayPage data={data} areas={days ? glance(days.checkIns, days.sleep) : null} />
          )
        ) : record ? <PastDay record={record} onToday={() => setSelected(startOfDay(new Date()))} /> : <Loader />}
      </Animated.View>
    </Screen>
  );
}

function TodayPage({ data, areas }: { data: NonNullable<ReturnType<typeof useToday>>; areas: AreaReading[] | null }) {
  const { signal } = useTheme();
  const { picture, weekStart } = usePreferences();
  const { reading, facts, weather, checkedInToday, lastNight } = data;
  const receipts = facts.slice(0, 3);

  return (
    <>
      <View style={styles.hero}>
        <FloatingDisc name={picture === 'daily' ? artOfTheDay() : picture} size={104} />
      </View>

      <View style={styles.block}>
        <Lede label={`your day at a glance · ${shortDate()}`} title={reading.headline}>
          <Text>{reading.subtext}</Text>
        </Lede>
      </View>

      <View style={styles.block}>
        <DoDont dos={reading.dos} donts={reading.donts} />
        {!checkedInToday && (
          <Button label="check in" arrow onPress={() => router.navigate('/check-in')} style={styles.cta} />
        )}
      </View>

      {/* The week's last day offers its reflection, as the reference's long read. */}
      {isWeekEnd(new Date(), weekStart) && (
        <Section title="this week">
          <Row title="Your week in reflection" subtitle="seven days, laid out" onPress={() => router.push('/week')} />
        </Section>
      )}

      {areas && (
        <Section title="by area">
          <Glance areas={areas} />
        </Section>
      )}

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

      <ArtRule name="masks" size={120} />

      {weather && (
        <Section title="inner weather">
          <View style={styles.weather}>
            <WeatherMark color={signal} />
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
    </>
  );
}

/** An earlier day, as it stood that evening — and everything written in it. */
function PastDay({ record, onToday }: { record: DayRecord; onToday: () => void }) {
  const { view, checkIns, night, pages, weather } = record;
  const date = new Date(`${record.date}T12:00:00`);
  const quiet = checkIns.length === 0 && !night && pages.length === 0;

  return (
    <>
      <View style={styles.block}>
        <Lede label={date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} title={view.reading.headline}>
          <Text>{view.reading.subtext}</Text>
        </Lede>
        <DoDont dos={view.reading.dos} donts={view.reading.donts} />
      </View>

      {weather && (
        <Section title="that day's weather">
          <Text variant="title">{weather}</Text>
        </Section>
      )}

      {checkIns.length > 0 && (
        <Section title={checkIns.length === 1 ? 'the check-in' : `${checkIns.length} check-ins`}>
          {checkIns.map(c => (
            <View key={c.id} style={styles.entry}>
              <Text variant="mono" tone="soft">
                {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {c.tags.length ? ` · ${c.tags.join(', ')}` : ''}
              </Text>
              <Text variant="heading">{c.emotion}</Text>
              {c.note && <Text variant="bodyItalic">{`“${c.note}”`}</Text>}
            </View>
          ))}
        </Section>
      )}

      {night && (
        <Section title="that night">
          <Row
            title={formatDuration(night.minutes)}
            subtitle={`${formatClock(clockOf(night.bedAt))} – ${formatClock(clockOf(night.wakeAt))}`}
          />
        </Section>
      )}

      {pages.length > 0 && (
        <Section title={pages.length === 1 ? 'a page you kept' : `${pages.length} pages you kept`}>
          {pages.map(p => (
            <Row key={p.id} title={firstLine(p.body)} subtitle="vent" arrow={false} />
          ))}
        </Section>
      )}

      {quiet && (
        <>
          <ArtRule name="swallow" size={90} side="right" />
          <Text tone="soft">A quiet day — nothing was written down, and that’s allowed.</Text>
        </>
      )}

      <Button kind="link" label="back to today" onPress={onToday} />
    </>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xl },
  // The reference's opening: the picture high on the right, then a long pause.
  hero: { alignItems: 'flex-end', paddingTop: space.sm, paddingBottom: space.xl },
  block: { gap: space.lg },
  cta: { marginTop: space.sm },
  weather: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  entry: { gap: 2, paddingVertical: space.sm }
});
