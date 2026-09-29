import { Pressable, StyleSheet } from 'react-native';

import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  /** 'button' acts on a tap; 'checkbox' toggles, and says so to screen readers. */
  role?: 'button' | 'checkbox';
  disabled?: boolean;
  onPress: () => void;
};

/** A word or tag in a wrapping row: a ruled box, inverted when selected. */
export function Chip({ label, selected = false, role = 'button', disabled, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'checkbox' ? { checked: selected, disabled: !!disabled } : { selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={state => [
        styles.chip,
        {
          borderColor: colors.hairline,
          backgroundColor: selected ? colors.ink : colors.paper,
          opacity: state.pressed ? 0.6 : 1
        }
      ]}
    >
      <Text variant="caption" style={{ color: selected ? colors.paper : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: hitTarget,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.none,
    borderWidth: 1
  }
});
