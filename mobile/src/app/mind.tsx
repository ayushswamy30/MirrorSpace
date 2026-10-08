import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Art } from '@/components/Art';
import { Box, DoDont, EndMark, Lede, Section } from '@/components/Blocks';
import { SubHeader } from '@/components/Header';
import { Loader } from '@/components/Loader';
import { Locked } from '@/components/Locked';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { currentMindChart, REDRAW_DAYS, type MindChart, type Placement, type TagLean } from '@/lib/mindChart';
import { space } from '@/theme/tokens';

/**
 * The Mind Chart — from day 14, after the reference's chart of boxed
 * placements: when the nights sit, the hours that run lightest, how heavy
 * days show up, what drains and restores, how fast the lighter days come
 * back, and people or alone. Each with what it was drawn from. Redrawn
 * monthly; the waiting placements say what they still need.
 */
export default function Mind() {
  return (
    <Locked feature="mindChart" promise="Your mind chart, drawn from your own rhythm.">
      <MindPage />
    </Locked>
  );
}

function MindPage() {
  const [chart, setChart] = useState<MindChart | null>(null);

  useEffect(() => {
    currentMindChart()
      .then(setChart)
      .catch(err => console.warn('Mind chart unavailable:', err));
  }, []);

  const header = <SubHeader title="mind chart" leading="close" />;
  if (!chart) {
    return (
      <Screen edges={['top', 'bottom']} header={header} scroll={false}>
        <Loader fill label="Drawing your chart" />
      </Screen>
    );
  }

  const drawn = new Date(chart.drawnAt);
  const next = new Date(drawn.getFullYear(), drawn.getMonth(), drawn.getDate() + REDRAW_DAYS);
  const day = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Screen edges={['top', 'bottom']} header={header}>
      <Art name="urchin" size={112} style={styles.art} />
      <Lede label={`mind chart · drawn ${day(drawn)}`} title="Your placements.">
        <Text tone="soft">
          {chart.complete
            ? `Drawn from your last ninety days. Redrawn on ${day(next)}.`
            : 'Drawn from your last ninety days. Some placements are still filling in — they draw themselves as the days come.'}
        </Text>
      </Lede>

      <PlacementBox title="your nights" placement={chart.rhythm} />
      <PlacementBox title="lightest hours" placement={chart.hours} />
      <PlacementBox title="heavy days show up as" placement={chart.stress} />

      <Section title="restores · drains">
        {chart.restorers.length + chart.drains.length > 0 ? (
          <>
            <DoDont
              dos={chart.restorers.length ? chart.restorers.map(r => r.tag) : ['—']}
              donts={chart.drains.length ? chart.drains.map(d => d.tag) : ['—']}
              titles={['restores', 'drains']}
            />
            <Text variant="mono" tone="soft">
              {[...chart.restorers, ...chart.drains].map(leanReceipt).join(' · ')}
            </Text>
          </>
        ) : (
          <Text tone="soft">Needs a few more tagged check-ins — tags are how the chart sees what’s around your days.</Text>
        )}
      </Section>

      <PlacementBox title="lighter again" placement={chart.recovery} />
      <PlacementBox title="people, or alone" placement={chart.social} />

      <Text variant="mono" tone="soft">
        Patterns in what you’ve logged, not a diagnosis. Each line says what it was drawn from.
      </Text>

      <EndMark />
    </Screen>
  );
}

function leanReceipt(l: TagLean): string {
  return `${l.tag} ${l.gap > 0 ? '+' : '−'}${Math.abs(l.gap).toFixed(1)} (${l.count})`;
}

/** One placement: the reference's boxed "HARMONY / Renewed authority". */
function PlacementBox({ title, placement }: { title: string; placement: Placement }) {
  return (
    <Box title={title} centred>
      <View
        style={styles.placement}
        accessible
        accessibilityLabel={placement.value ? `${title}: ${placement.value}. ${placement.line}` : `${title}: not yet. ${placement.line}`}
      >
        <Text variant="title" tone={placement.value ? 'ink' : 'soft'} style={styles.centre}>
          {placement.value ?? 'not yet'}
        </Text>
        <Text tone="soft" style={styles.centre}>
          {placement.line}
        </Text>
        {placement.receipt !== '' && (
          <Text variant="mono" tone="soft" style={styles.centre}>
            {placement.receipt}
          </Text>
        )}
      </View>
    </Box>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'flex-end' },
  placement: { gap: space.sm, alignItems: 'center', paddingVertical: space.xs },
  centre: { textAlign: 'center' }
});
