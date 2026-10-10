import { Image, Pressable, StyleSheet, View } from 'react-native';

import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Art, ART_NAMES, isArtName, type ArtName } from './Art';
import { Text } from './Text';

/**
 * A person, as a plate: their own photo (only ever on their own phone), the
 * cut-out they chose, or the first letter of their name in serif.
 */
export function Avatar({ icon, name, size = 44, photo }: { icon: string | null | undefined; name: string; size?: number; photo?: string | null }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.plate, { width: size, height: size, backgroundColor: colors.disc, borderColor: colors.glassEdge }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} />
      ) : isArtName(icon) ? (
        <Art name={icon} size={size * 0.66} />
      ) : (
        <Text variant="heading" style={{ fontSize: size * 0.46, lineHeight: size * 0.56 }}>
          {name.trim().charAt(0).toUpperCase() || '·'}
        </Text>
      )}
    </View>
  );
}

/** Every cut-out, as plates to choose from; the chosen one is ruled round. */
export function IconPicker({ value, onChange }: { value: ArtName | null; onChange: (icon: ArtName) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {ART_NAMES.map(name => {
        const chosen = value === name;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ checked: chosen }}
            onPress={() => onChange(name)}
            style={[styles.option, { borderColor: chosen ? colors.ink : 'transparent' }]}
          >
            <Avatar icon={name} name={name} size={44} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderRadius: radius.dot,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: {
    minWidth: hitTarget + 6,
    minHeight: hitTarget + 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.dot
  }
});
