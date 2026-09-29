import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './icons';
import { Text } from './Text';

/**
 * The page's building blocks, after DESIGN.md: section labels, segmented
 * tabs, list rows, ruled boxes and a thick band.
 */

/** A mono capital label with a rule under it: "YOUR DAY AT A GLANCE". */
export function SectionLabel({ title, rule = true }: { title: string; rule?: boolean }) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.section, rule && { borderBottomColor: colors.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <Text variant="label" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** A full-bleed thick break between sections. */
export function Band() {
  const { colors } = useTheme();
  return <View style={[styles.band, { backgroundColor: colors.band }]} />;
}

type SegmentedProps<K extends string> = {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

/** Mono tabs with a ○ bullet, ● and an underline on the current one. */
export function Segmented<K extends string>({ options, value, onChange }: SegmentedProps<K>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.segmentedWrap, { borderBottomColor: colors.hairline }]}
      contentContainerStyle={styles.segmented}
      accessibilityRole="tablist"
    >
      {options.map(option => {
        const active = option.key === value;
        const color = active ? colors.ink : colors.inkSoft;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            style={[styles.segment, { borderBottomColor: active ? colors.ink : 'transparent' }]}
          >
            <View style={[styles.bullet, { borderColor: color, backgroundColor: active ? color : 'transparent' }]} />
            <Text variant="label" style={{ color }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  /** A small image or icon at the start of the row. */
  leading?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** A list row: serif title, soft subtitle, → at the end, a rule under it. */
export function Row({ title, subtitle, leading, onPress, accessibilityHint }: RowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.hairline, backgroundColor: pressed ? colors.band : 'transparent' }
      ]}
    >
      {leading && <View style={styles.rowLeading}>{leading}</View>}
      <View style={styles.rowText}>
        <Text variant="heading">{title}</Text>
        {subtitle && (
          <Text variant="caption" tone="soft">
            {subtitle}
          </Text>
        )}
      </View>
      {onPress && <Icon name="arrow" color={colors.ink} size={16} />}
    </Pressable>
  );
}

type BoxProps = {
  /** A mono header row, ruled off from the content. */
  title?: string;
  children: ReactNode;
  centred?: boolean;
};

/** A 1px ink box — the reference's "HARMONY / Renewed authority" card. */
export function Box({ title, children, centred = false }: BoxProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.box, { borderColor: colors.ink }]}>
      {title && (
        <View style={[styles.boxTitle, { borderBottomColor: colors.ink }]}>
          <Text variant="label" style={centred && styles.centre}>
            {title}
          </Text>
        </View>
      )}
      <View style={[styles.boxBody, centred && styles.boxCentred]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingBottom: space.sm },
  band: { height: space.md, marginHorizontal: -gutter },
  segmentedWrap: { flexGrow: 0, marginHorizontal: -gutter, borderBottomWidth: StyleSheet.hairlineWidth },
  segmented: { paddingHorizontal: gutter, gap: space.lg },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: hitTarget,
    borderBottomWidth: 1.5
  },
  bullet: { width: 7, height: 7, borderRadius: radius.dot, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hitTarget + 16,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowLeading: { width: 36, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  box: { borderWidth: 1, borderRadius: radius.none },
  boxTitle: { paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderBottomWidth: 1 },
  boxBody: { padding: space.md, gap: space.xs },
  boxCentred: { alignItems: 'center' },
  centre: { textAlign: 'center' }
});
