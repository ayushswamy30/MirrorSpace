import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { CareBar } from './CareBar';
import { Text } from './Text';

/**
 * Five tab names in mono capitals — text only, no icons (DESIGN.md). The
 * current tab is ink with a small weather-coloured dot; the rest are soft ink.
 *
 * Calm tools and "Need help now" sit above the tabs (report §7), part of the
 * bar so they are on every tab screen without each screen remembering them.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, signal } = useTheme();

  return (
    <View style={{ backgroundColor: colors.paper, paddingBottom: Math.max(insets.bottom, space.xs) }}>
      <CareBar />
      <View style={[styles.tabs, { borderTopColor: colors.hairline }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={styles.tab}
            >
              <Text variant="label" numberOfLines={1} style={{ color: focused ? colors.ink : colors.inkSoft }}>
                {label}
              </Text>
              <View style={[styles.mark, { backgroundColor: focused ? signal : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: gutter - space.sm,
    paddingTop: space.sm
  },
  tab: {
    flex: 1,
    minHeight: hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs
  },
  mark: { width: 4, height: 4, borderRadius: radius.dot }
});
