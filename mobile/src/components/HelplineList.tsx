import { getLocales } from 'expo-localization';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { emergencyNumberFor, helplinesFor, type Helpline } from '@/lib/helplines';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/**
 * Crisis lines for the device's region first, then the rest, then emergency
 * services. Touches no session, network or database, so it can be shown from
 * anywhere — including over the app lock.
 */
export function HelplineList() {
  const region = getLocales()[0]?.regionCode ?? null;
  const emergency = emergencyNumberFor(region);

  return (
    <View style={styles.list}>
      {helplinesFor(region).map(line => (
        <HelplineCard key={`${line.region}-${line.name}`} line={line} />
      ))}
      <Text>
        If you are in immediate danger, call emergency services on{' '}
        <Text accessibilityRole="link" style={styles.underline} onPress={() => Linking.openURL(`tel:${emergency}`)}>
          {emergency}
        </Text>
        .
      </Text>
    </View>
  );
}

function HelplineCard({ line }: { line: Helpline }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { borderColor: colors.hairline, backgroundColor: colors.paperRaised }]}>
      <Text variant="label" tone="soft">
        {line.regionName}
      </Text>
      <Text variant="title">{line.name}</Text>
      <Text variant="receipt" tone="soft">
        {line.hours}
      </Text>
      <View style={styles.actions}>
        {line.call && (
          <ActionPill label={`call ${line.display}`} a11y={`Call ${line.name} on ${line.display}`} url={`tel:${line.call}`} />
        )}
        {line.text && (
          <ActionPill label={`text ${line.display}`} a11y={`Text ${line.name} on ${line.display}`} url={`sms:${line.text}`} />
        )}
      </View>
    </View>
  );
}

function ActionPill({ label, a11y, url }: { label: string; a11y: string; url: string }) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.pill, { borderColor: colors.ink, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  pill: {
    minHeight: hitTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center'
  },
  underline: { textDecorationLine: 'underline' }
});
