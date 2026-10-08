import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Art } from '@/components/Art';
import { Box, EndMark, Lede, Row, Section } from '@/components/Blocks';
import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { Loader } from '@/components/Loader';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { allCheckIns, localDate, type CheckIn } from '@/lib/checkIns';
import {
  compare,
  dayOf,
  EXPERIMENT_DAYS,
  listExperiments,
  PRESETS,
  setKept,
  startExperiment,
  stateOf,
  stopExperiment,
  type Experiment
} from '@/lib/experiments';
import { allSleep, formatDuration, type SleepLog } from '@/lib/sleep';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

/**
 * Personal experiments: one small change for seven days, then the week
 * before set beside the week of it. One at a time; marking a day kept is a
 * single tap and entirely optional.
 */

type Data = { experiments: Experiment[]; checkIns: CheckIn[]; sleep: SleepLog[] };

export default function Experiments() {
  const [data, setData] = useState<Data | null>(null);
  const today = localDate(new Date());

  const load = useCallback(() => {
    Promise.all([listExperiments(), allCheckIns(), allSleep()])
      .then(([experiments, checkIns, sleep]) => setData({ experiments, checkIns, sleep }))
      .catch(err => console.warn('Experiments unavailable:', err));
  }, []);
  useEffect(load, [load]);

  const header = <SubHeader title="experiments" leading="close" />;
  if (!data) {
    return (
      <Screen edges={['top', 'bottom']} header={header} scroll={false}>
        <Loader fill />
      </Screen>
    );
  }

  const running = data.experiments.find(e => stateOf(e, today) === 'running') ?? null;
  const past = data.experiments.filter(e => stateOf(e, today) !== 'running');

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      <Art name="dice" size={96} style={styles.art} />
      {running ? <Running experiment={running} today={today} onChange={load} /> : <Choose onStarted={load} />}

      {past.length > 0 && (
        <Section title="before and after">
          {past.map(e => (
            <Result key={e.id} experiment={e} checkIns={data.checkIns} sleep={data.sleep} today={today} />
          ))}
          <Text variant="caption" tone="soft">
            This shows what changed alongside each experiment — not that the experiment caused it.
          </Text>
        </Section>
      )}

      <EndMark />
    </Screen>
  );
}

function Running({ experiment, today, onChange }: { experiment: Experiment; today: string; onChange: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const day = dayOf(experiment, today);
  const keptToday = experiment.kept.includes(today);
  const days = Array.from({ length: EXPERIMENT_DAYS }, (_, i) => {
    const d = new Date(`${experiment.startsOn}T12:00:00`);
    return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
  });

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    work()
      .then(onChange)
      .catch(err => console.warn('Experiment not saved:', err))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Lede label={`experiment · day ${day} of ${EXPERIMENT_DAYS}`} title={experiment.title}>
        <Text tone="soft">
          {`Until ${new Date(`${experiment.endsOn}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}. Then the week before is set beside this one.`}
        </Text>
      </Lede>

      <Section title="the seven days">
        <View
          style={styles.days}
          accessible
          accessibilityLabel={`Kept on ${experiment.kept.length} of ${day} days so far`}
        >
          {days.map(d => {
            const kept = experiment.kept.includes(d);
            const ahead = d > today;
            return (
              <View key={d} style={styles.day}>
                <Text variant="label" tone="soft" style={styles.letter}>
                  {new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
                </Text>
                <View
                  style={[
                    styles.square,
                    { borderColor: ahead ? colors.inkFaint : colors.ink, backgroundColor: kept ? colors.ink : 'transparent' },
                    d === today && styles.todaySquare
                  ]}
                />
              </View>
            );
          })}
        </View>
        <Button
          label={keptToday ? 'kept it today ✓' : 'I kept it today'}
          kind={keptToday ? 'outline' : 'primary'}
          disabled={busy}
          onPress={() => run(() => setKept(experiment, today, !keptToday))}
        />
        <Text variant="mono" tone="soft">
          Marking a day is optional — the comparison uses your check-ins and nights either way.
        </Text>
      </Section>

      <Button kind="link" label="stop it early" disabled={busy} onPress={() => run(() => stopExperiment(experiment))} />
    </>
  );
}

function Choose({ onStarted }: { onStarted: () => void }) {
  const { colors } = useTheme();
  const [own, setOwn] = useState('');
  const start = (title: string) => {
    startExperiment(title)
      .then(onStarted)
      .catch(err => console.warn('Experiment not started:', err));
  };

  return (
    <>
      <Lede label="experiments" title="Try one small change for a week.">
        <Text tone="soft">
          Afterwards, the week before is set beside the week of it — on your own check-ins and nights.
        </Text>
      </Lede>

      <Section title="choose one">
        {PRESETS.map(p => (
          <Row key={p} title={p} onPress={() => start(p)} accessibilityHint="Starts a seven-day experiment" />
        ))}
      </Section>

      <Section title="or your own">
        <TextInput
          value={own}
          onChangeText={setOwn}
          placeholder="Something small, for seven days"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Your own experiment"
          maxLength={80}
          maxFontSizeMultiplier={2}
          style={[styles.input, { color: colors.ink, borderBottomColor: colors.ink }]}
        />
        <Button label="start" arrow disabled={own.trim().length < 3} onPress={() => start(own)} />
      </Section>
    </>
  );
}

function Result({ experiment, checkIns, sleep, today }: { experiment: Experiment; checkIns: CheckIn[]; sleep: SleepLog[]; today: string }) {
  const c = compare(experiment, checkIns, sleep, today);
  const mood = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`);
  const night = (n: number | null) => (n === null ? '—' : formatDuration(n));
  const when = new Date(`${experiment.startsOn}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Box title={`${experiment.title} · ${when}`}>
      <View style={styles.result}>
        <Text variant="mono" tone="soft">
          {`${stateOf(experiment, today) === 'stopped' ? `stopped on day ${c.days}` : `${c.days} days`} · kept ${c.kept} of ${c.days}`}
        </Text>
        {c.lines.length > 0 ? (
          c.lines.map(line => (
            <Text key={line} variant="heading">
              {line}
            </Text>
          ))
        ) : (
          <Text tone="soft">Too little was logged in one of the two weeks to set them side by side.</Text>
        )}
        <Text variant="mono" tone="soft">
          {`before: mood ${mood(c.before.mood)} (${c.before.checkIns}) · nights ${night(c.before.sleep)} (${c.before.nights})`}
        </Text>
        <Text variant="mono" tone="soft">
          {`during: mood ${mood(c.during.mood)} (${c.during.checkIns}) · nights ${night(c.during.sleep)} (${c.during.nights})`}
        </Text>
      </View>
    </Box>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  days: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  day: { alignItems: 'center', gap: space.sm },
  letter: { fontSize: 9 },
  square: { width: 30, height: 30, borderWidth: 1, borderRadius: radius.none },
  todaySquare: { borderWidth: 2 },
  input: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, paddingVertical: space.sm, borderBottomWidth: 1 },
  result: { gap: space.sm }
});
