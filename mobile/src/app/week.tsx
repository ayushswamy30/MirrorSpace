import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Art } from '@/components/Art';
import { Box, DoDont, EndMark, Lede, Section } from '@/components/Blocks';
import { SubHeader } from '@/components/Header';
import { Loader } from '@/components/Loader';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { WEATHER_INK } from '@/lib/chart';
import { allCheckIns } from '@/lib/checkIns';
import { allSleep, formatDuration } from '@/lib/sleep';
import { weekReflection, type WeekReflection } from '@/lib/week';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The week in reflection (report: "Sunday 'week in reflection'"): the last
 * seven days laid out — weather, the lightest and heaviest, the words, what
 * surrounded them, and the nights. Quiet days are counted, not mourned.
 */
export default function Week() {
  const [week, setWeek] = useState<WeekReflection | null>(null);

  useEffect(() => {
    Promise.all([allCheckIns(), allSleep()])
      .then(([checkIns, sleep]) => setWeek(weekReflection(checkIns, sleep)))
      .catch(err => console.warn('Week unavailable:', err));
  }, []);

  const header = <SubHeader title="the week" leading="close" />;
  if (!week) {
    return (
      <Screen edges={['top', 'bottom']} header={header} scroll={false}>
        <Loader fill label="Laying out the week" />
      </Screen>
    );
  }

  const first = new Date(`${week.days[0].date}T12:00:00`);
  const last = new Date(`${week.days[6].date}T12:00:00`);
  const span = `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      <Art name="swallow" size={96} style={styles.art} />
      <Lede label={`week in reflection · ${span}`} title="The week, laid out.">
        <Text>{week.summary}</Text>
      </Lede>

      <Section title="seven days">
        <Days week={week} />
        <Text variant="mono" tone="soft">
          {week.quiet === 0
            ? 'Every day has a word in it.'
            : `${week.checkedIn} ${week.checkedIn === 1 ? 'day' : 'days'} with a word · ${week.quiet} quiet ${week.quiet === 1 ? 'day' : 'days'}`}
        </Text>
      </Section>

      {(week.lightest || week.heaviest) && (
        <DoDont
          dos={week.lightest ? [week.lightest.weekday] : ['—']}
          donts={week.heaviest ? [week.heaviest.weekday] : ['—']}
          titles={['lightest', 'heaviest']}
        />
      )}

      {week.words.length > 0 && (
        <Box title="words of the week" centred>
          <Text variant="heading">{week.words.map(w => w.word).join(' · ')}</Text>
        </Box>
      )}

      {week.tags.length > 0 && (
        <Section title="around the days">
          {week.tags.map(t => (
            <View key={t.tag} style={styles.line}>
              <Text variant="heading" style={styles.flex}>
                {t.tag}
              </Text>
              <Text variant="mono" tone="soft">{`${t.count}× · ${t.lean}`}</Text>
            </View>
          ))}
        </Section>
      )}

      <Section title="nights">
        {week.nights.average ? (
          <View style={styles.nights}>
            <Text variant="title">{formatDuration(week.nights.average)}</Text>
            <Text variant="mono" tone="soft">
              {`average · ${week.nights.count} ${week.nights.count === 1 ? 'night' : 'nights'} logged${
                week.nights.shortest ? ` · shortest ${formatDuration(week.nights.shortest.minutes)}` : ''
              }`}
            </Text>
          </View>
        ) : (
          <Text tone="soft">No nights logged this week.</Text>
        )}
      </Section>

      <EndMark />
    </Screen>
  );
}

function Days({ week }: { week: WeekReflection }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.days}
      accessible
      accessibilityLabel={week.days.map(d => `${d.weekday}: ${d.weather ?? 'quiet'}`).join(', ')}
    >
      {week.days.map(d => (
        <View key={d.date} style={styles.day}>
          <Text variant="label" tone="soft" style={styles.letter}>
            {d.weekday.slice(0, 3)}
          </Text>
          {d.weather ? (
            <View style={[styles.circle, { borderColor: colors.ink }]}>
              <View style={[styles.fill, { backgroundColor: colors.ink, opacity: WEATHER_INK[d.weather] }]} />
            </View>
          ) : (
            <View style={[styles.circle, styles.quiet, { borderColor: colors.inkFaint }]} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  days: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  day: { alignItems: 'center', gap: space.sm },
  letter: { fontSize: 9 },
  circle: { width: 30, height: 30, borderRadius: radius.dot, borderWidth: 1, overflow: 'hidden' },
  quiet: { borderStyle: 'dashed' },
  fill: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingVertical: space.xs },
  flex: { flex: 1 },
  nights: { gap: 2 }
});
