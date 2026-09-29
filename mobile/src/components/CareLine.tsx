import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

/**
 * The low-concern response (report §8): one quiet sentence and a way to
 * help. No interruption, no alarm — just a door left open.
 */
export function CareLine() {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text variant="bodyItalic">
        That sounds heavy. If it gets heavier, help is one tap away.
      </Text>
      <Button kind="link" label="need help now" onPress={() => router.push('/help')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs }
});
