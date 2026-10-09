import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Art } from '@/components/Art';
import { EndMark, Lede, Section, Segmented } from '@/components/Blocks';
import { SubHeader } from '@/components/Header';
import { Loader } from '@/components/Loader';
import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { ShareButton, WrappedCard } from '@/components/ShareCard';
import { Text } from '@/components/Text';
import { allCheckIns, type CheckIn } from '@/lib/checkIns';
import { allSleep, type SleepLog } from '@/lib/sleep';
import { pageDates } from '@/lib/vents';
import { spanOf, storyOf, wrapped, type WrappedPeriod } from '@/lib/wrapped';
import { space } from '@/theme/tokens';

/**
 * Wrapped — from day 30: a month or the year so far, told back one plain
 * statement at a time, story-sized for sharing. Never a score or a streak.
 */
const PERIODS: readonly { key: WrappedPeriod; label: string }[] = [
  { key: 'this-month', label: 'this month' },
  { key: 'last-month', label: 'last month' },
  { key: 'this-year', label: 'this year' }
];

export default function WrappedScreen() {
  return (
    <Locked feature="wrapped" promise="Your month, wrapped — once there’s a month of you.">
      <WrappedPage />
    </Locked>
  );
}

type Data = { checkIns: CheckIn[]; sleep: SleepLog[]; pages: string[] };

function WrappedPage() {
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState<WrappedPeriod>('this-month');

  useEffect(() => {
    Promise.all([allCheckIns(), allSleep(), pageDates()])
      .then(([checkIns, sleep, pages]) => setData({ checkIns, sleep, pages }))
      .catch(err => console.warn('Wrapped unavailable:', err));
  }, []);

  const header = <SubHeader title="wrapped" leading="close" />;
  if (!data) {
    return (
      <Screen edges={['top', 'bottom']} header={header} scroll={false}>
        <Loader fill label="Wrapping it up" />
      </Screen>
    );
  }

  const w = wrapped(data.checkIns, data.sleep, data.pages, spanOf(period));
  const story = storyOf(w);

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <Art name="butterfly" size={104} style={styles.art} />
      <Lede label={`wrapped · ${w.span.label}`} title={`${w.span.label}, wrapped.`} size="title">
        <Text tone="soft">What you wrote down, told back. Counts and plain facts — no scores.</Text>
      </Lede>

      {story.map(s => (
        <Section key={s.key} title={s.label}>
          <View style={styles.statement}>
            <Text variant="reading">{s.title}</Text>
            {s.line && <Text tone="soft">{s.line}</Text>}
          </View>
        </Section>
      ))}

      {w.checkedIn > 0 && <ShareButton label="share it" card={<WrappedCard story={story} label={w.span.label} />} />}

      <EndMark />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  statement: { gap: space.xs, paddingTop: space.xs }
});
