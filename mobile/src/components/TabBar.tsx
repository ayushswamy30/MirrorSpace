import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { hitTarget, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { CareBar } from './CareBar';
import { Icon, type IconName } from './icons';
import { Text } from './Text';

const ICONS: Record<string, IconName> = {
  index: 'today',
  'check-in': 'checkIn',
  mirror: 'mirror',
  chart: 'chart',
  circle: 'circle'
};

/**
 * Five tabs, with calm tools and "Need help now" sitting above all of them
 * (report §7) — the care bar is part of the tab bar so it is on every tab
 * screen without each screen having to remember it.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, signal } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.paper, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <CareBar />
      <View style={[styles.tabs, { borderTopColor: colors.hairline }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const color = focused ? signal : colors.inkSoft;

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
              <Icon name={ICONS[route.name] ?? 'today'} color={color} size={22} />
              <Text variant="label" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.sm },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm
  },
  tab: {
    flex: 1,
    minHeight: hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  }
});
