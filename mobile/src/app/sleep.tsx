import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { SubHeader } from '@/components/Header';
import { Art } from '@/components/Art';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { localDate } from '@/lib/checkIns';
import {
  allSleep,
  clockOf,
  DEFAULT_BED,
  DEFAULT_WAKE,
  formatClock,
  formatDuration,
  night,
  saveSleep,
  step,
  type ClockTime
} from '@/lib/sleep';
import { hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Last night, by hand: two times, fifteen-minute steps, one save. Opens on
 * last night's log if there is one, else on the usual times.
 */
export default function Sleep() {
  const [bed, setBed] = useState<ClockTime>(DEFAULT_BED);
  const [wake, setWake] = useState<ClockTime>(DEFAULT_WAKE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    allSleep()
      .then(logs => {
        const today = localDate(new Date());
        const seed = logs.find(l => l.wakeDate === today) ?? logs[logs.length - 1];
        if (seed) {
          setBed(clockOf(seed.bedAt));
          setWake(clockOf(seed.wakeAt));
        }
      })
      .catch(() => undefined);
  }, []);

  const preview = night(bed, wake, new Date());

  const save = async () => {
    try {
      await saveSleep(night(bed, wake, new Date()));
      router.back();
    } catch (err) {
      console.error('Sleep not saved:', err);
      setError('That didn’t save. Try once more.');
    }
  };

  return (
    <Screen edges={['top', 'bottom']} header={<SubHeader title="last night" leading="close" />}>
      <View style={{ gap: space.lg }}>
        <Art name="city" size={180} style={{ alignSelf: 'flex-end' }} />
        <Text variant="reading">How did you sleep?</Text>
      </View>

      <View style={{ gap: space.md }}>
        <View>
          <Stepper label="went to bed" value={bed} onChange={setBed} />
          <Stepper label="woke up" value={wake} onChange={setWake} />
        </View>
        <Text variant="mono" tone="soft" accessibilityLiveRegion="polite">
          {formatDuration(preview.minutes)}
        </Text>
      </View>

      {error && (
        <Text variant="bodyItalic" accessibilityRole="alert">
          {error}
        </Text>
      )}

      <View style={{ gap: space.md }}>
        <Button label="save" arrow onPress={save} />
        <Text variant="caption" tone="soft">
          Kept on this phone. With readings on, Today looks for how your nights and days go together.
        </Text>
      </View>
    </Screen>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: ClockTime; onChange: (t: ClockTime) => void }) {
  const { colors } = useTheme();
  const box = [styles.step, { borderColor: colors.ink }];

  return (
    <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, 15 minutes earlier`}
        onPress={() => onChange(step(value, -1))}
        style={box}
      >
        <Text variant="action">−</Text>
      </Pressable>
      <Text variant="title" style={styles.time} accessibilityLabel={`${label} ${formatClock(value)}`}>
        {formatClock(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, 15 minutes later`}
        onPress={() => onChange(step(value, 1))}
        style={box}
      >
        <Text variant="action">+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  label: { flex: 1 },
  time: { minWidth: 84, textAlign: 'center' },
  step: { width: hitTarget, height: hitTarget, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }
});
