import { getLocales } from 'expo-localization';
import { Linking, StyleSheet, View } from 'react-native';

import { emergencyNumberFor, helplinesFor, type Helpline } from '@/lib/helplines';
import { space } from '@/theme/tokens';

import { Box } from './Blocks';
import { Button } from './Button';
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
  return (
    <Box title={line.regionName}>
      <Text variant="heading">{line.name}</Text>
      <Text variant="mono" tone="soft">
        {line.hours}
      </Text>
      <View style={styles.actions}>
        {line.call && (
          <Button
            kind="outline"
            label={`call ${line.display}`}
            accessibilityLabel={`Call ${line.name} on ${line.display}`}
            onPress={() => Linking.openURL(`tel:${line.call}`)}
          />
        )}
        {line.text && (
          <Button
            kind="outline"
            label={`text ${line.display}`}
            accessibilityLabel={`Text ${line.name} on ${line.display}`}
            onPress={() => Linking.openURL(`sms:${line.text}`)}
          />
        )}
      </View>
    </Box>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  underline: { textDecorationLine: 'underline' }
});
