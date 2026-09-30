import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { dark, gutter, hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/**
 * Five tab names in small mono capitals — text only, no icons, no rule
 * (DESIGN.md). The first and last names sit on the page's margins and the
 * gaps between all five are equal, whatever each name's length. The current
 * tab is ink with a small weather-coloured dot; the rest are soft ink.
 * Under the Mirror room the bar goes dark with it, whatever the theme, so
 * the room runs to the bottom of the screen as the reference's Void does.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const onVoid = state.routes[state.index]?.name === 'mirror';
  const colors = onVoid ? { ...dark, paper: theme.colors.void } : theme.colors;
  const signal = onVoid ? dark.signal[theme.weather ?? 'fog'] : theme.signal;

  return (
    <View style={{ backgroundColor: colors.paper, paddingBottom: Math.max(insets.bottom, space.sm) }}>
      <View style={styles.tabs} accessibilityRole="tablist">
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
              hitSlop={{ top: space.sm, bottom: space.sm }}
              style={styles.tab}
            >
              <Text variant="label" numberOfLines={1} style={[styles.label, { color: focused ? colors.ink : colors.inkSoft }]}>
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

const PAD = space.sm;

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Each tab's own padding widens its touch area; this keeps the words
    // themselves on the page margin.
    paddingHorizontal: gutter - PAD,
    paddingTop: space.md
  },
  tab: {
    minHeight: hitTarget,
    paddingHorizontal: PAD,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2
  },
  label: { fontSize: 10, letterSpacing: 1.2 },
  mark: { width: 4, height: 4, borderRadius: radius.dot }
});
