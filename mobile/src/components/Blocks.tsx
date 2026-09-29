import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

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
  /** Runs edge to edge by default; false keeps it inside a box. */
  bleed?: boolean;
};

/** Mono tabs with a ○ bullet, ● and an underline on the current one. */
export function Segmented<K extends string>({ options, value, onChange, bleed = true }: SegmentedProps<K>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.segmentedWrap, bleed && styles.bleed, { borderBottomColor: colors.hairline }]}
      contentContainerStyle={[styles.segmented, !bleed && styles.inset]}
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
  /** The → at the end; off for rows that act in place rather than open something. */
  arrow?: boolean;
  selected?: boolean;
};

/** A list row: serif title, soft subtitle, → at the end, a rule under it. */
export function Row({ title, subtitle, leading, onPress, accessibilityHint, arrow = true, selected }: RowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? undefined : { selected }}
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
      {onPress && arrow && <Icon name="arrow" color={colors.ink} size={16} />}
    </Pressable>
  );
}

/** Two columns, a small grey mono heading over serif items. */
export function DoDont({ dos, donts }: { dos: readonly string[]; donts: readonly string[] }) {
  return (
    <View style={styles.doDont}>
      {[
        { title: 'Do', items: dos },
        { title: 'Don’t', items: donts }
      ].map(col => (
        <View key={col.title} style={styles.column} accessible accessibilityLabel={`${col.title}: ${col.items.join(', ')}`}>
          <Text variant="mono" tone="soft">
            {col.title}
          </Text>
          {col.items.map(item => (
            <Text key={item} variant="heading">
              {item}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * The bottom of a feed: an ink block that says it's over. The page ends; it
 * does not keep offering more.
 */
export function EndMark({ link, onPress }: { link?: string; onPress?: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.end, { backgroundColor: colors.ink }]}>
      <Text variant="title" style={{ color: colors.paper }}>
        The end
      </Text>
      {link && onPress && (
        <Pressable accessibilityRole="button" accessibilityLabel={link} onPress={onPress} hitSlop={8}>
          <Text variant="action" style={[styles.endLink, { color: colors.paper }]}>
            {link}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

type SettingProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** A settings line with a switch: grey when off, ink when on, no colour. */
export function SettingRow({ title, subtitle, value, onValueChange, disabled }: SettingProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
      <View style={styles.rowText}>
        <Text>{title}</Text>
        {subtitle && (
          <Text variant="caption" tone="soft">
            {subtitle}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ false: colors.inkSoft, true: colors.ink }}
        thumbColor={colors.paper}
        ios_backgroundColor={colors.inkSoft}
      />
    </View>
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
  segmentedWrap: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  bleed: { marginHorizontal: -gutter },
  segmented: { paddingHorizontal: gutter, gap: space.lg },
  inset: { paddingHorizontal: 0 },
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
  doDont: { flexDirection: 'row', gap: space.lg },
  column: { flex: 1, gap: 2 },
  end: {
    marginHorizontal: -gutter,
    marginBottom: -space.xxl,
    paddingTop: space.xxl,
    paddingBottom: space.xxl + space.lg,
    alignItems: 'center',
    gap: space.md
  },
  endLink: { textDecorationLine: 'underline' },
  box: { borderWidth: 1, borderRadius: radius.none },
  boxTitle: { paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderBottomWidth: 1 },
  boxBody: { padding: space.md, gap: space.xs },
  boxCentred: { alignItems: 'center' },
  centre: { textAlign: 'center' }
});
