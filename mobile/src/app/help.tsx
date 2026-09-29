import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { emergencyNumberFor, helplinesFor, type Helpline } from '@/lib/helplines';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Need help now. Deliberately plain: no animation, no poetry, no account
 * required — this screen does not touch the session, the network or the
 * database, so it opens in every state the app can be in.
 */
export default function Help() {
  const region = getLocales()[0]?.regionCode ?? null;
  const lines = helplinesFor(region);
  const emergency = emergencyNumberFor(region);

  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="title">You don’t have to get through this moment alone.</Text>
      <Text>
        These are free, confidential lines staffed by trained people. MirrorSpace is not one of them — it can’t
        call anyone for you.
      </Text>

      <View style={styles.list}>
        {lines.map(line => (
          <HelplineCard key={`${line.region}-${line.name}`} line={line} />
        ))}
      </View>

      <Text>
        If you are in immediate danger, call emergency services on{' '}
        <Text
          accessibilityRole="link"
          style={styles.underline}
          onPress={() => Linking.openURL(`tel:${emergency}`)}
        >
          {emergency}
        </Text>
        .
      </Text>

      <Button kind="quiet" label="close" onPress={() => router.back()} />
    </Screen>
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
          <ActionPill
            label={`call ${line.display}`}
            a11y={`Call ${line.name} on ${line.display}`}
            url={`tel:${line.call}`}
          />
        )}
        {line.text && (
          <ActionPill
            label={`text ${line.display}`}
            a11y={`Text ${line.name} on ${line.display}`}
            url={`sms:${line.text}`}
          />
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
