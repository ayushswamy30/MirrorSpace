import { SubHeader } from '@/components/Header';
import { SafetyPlan } from '@/components/SafetyPlan';
import { Screen } from '@/components/Screen';

/**
 * The safety plan on its own, for the crisis card's one-tap link. Outside the
 * session gate like calm and help: it reads only the device's own database.
 */
export default function Plan() {
  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="your safety plan" leading="close" />}>
      <SafetyPlan />
    </Screen>
  );
}
