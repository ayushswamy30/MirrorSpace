import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = {
  /** The screen's name, set in small capitals. */
  title: string;
  /** Defaults to today's date. Pass null for no second line. */
  dateline?: string | null;
};

export function todayDateline(now: Date = new Date()): string {
  return now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * The top of every main screen, set like a newspaper's: name, date, a rule.
 * The small dot beside the date is the Inner Weather signal — the one place
 * colour appears on the page, and small on purpose.
 */
export function Masthead({ title, dateline }: Props) {
  const { colors, signal } = useTheme();
  const line = dateline === undefined ? todayDateline() : dateline;

  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text variant="label">{title}</Text>
      {line !== null && (
        <View style={styles.dateRow}>
          <View
            style={[styles.dot, { backgroundColor: signal }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text variant="label" tone="soft">
            {line}
          </Text>
        </View>
      )}
      <View style={[styles.rule, { backgroundColor: colors.hairline }]} />
    </View>
  );
}

/** A section's name between two rules: ——— NAME ———. */
export function SectionHead({ title }: { title: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section} accessibilityRole="header">
      <View style={[styles.sectionRule, { backgroundColor: colors.hairline }]} />
      <Text variant="label" style={styles.sectionLabel}>
        {title}
      </Text>
      <View style={[styles.sectionRule, { backgroundColor: colors.hairline }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: radius.dot },
  rule: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, marginTop: space.sm },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionLabel: { flexShrink: 1, textAlign: 'center' }
});
