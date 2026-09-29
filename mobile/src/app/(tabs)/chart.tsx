import { Locked } from '@/components/Locked';
import { AppHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';

/**
 * Chart — patterns from day 7; the Mind Chart (day 14), Year in Weather and
 * experiments are v1.
 */
export default function Chart() {
  return (
    <Locked title="chart" feature="patterns" promise="Your patterns, once there are enough days to see them.">
      <Screen header={<AppHeader context="chart" />}>{null}</Screen>
    </Locked>
  );
}
