import type { BottomTabBarProps } from 'expo-router/tabs';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dark, hitTarget, radius, room, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

/**
 * The tab bar floats over the page, so the pages under it need to know how
 * much room to leave at the bottom. 0 outside the tabs.
 */
const InsetContext = createContext<{ inset: number; setInset: (n: number) => void }>({ inset: 0, setInset: () => undefined });

export function TabInsetProvider({ children }: { children: ReactNode }) {
  const [inset, setInset] = useState(0);
  return <InsetContext.Provider value={{ inset, setInset }}>{children}</InsetContext.Provider>;
}

export function useTabInset(): number {
  return useContext(InsetContext).inset;
}

/**
 * Six tab names in small mono capitals on a floating glass pill — text only,
 * no icons. The current tab sits in a softly lit capsule with a small
 * weather-coloured dot; the rest are soft ink. Under the Mirror room the pill
 * goes dark with it, whatever the theme.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const onVoid = state.routes[state.index]?.name === 'mirror';
  const colors = onVoid ? { ...dark, paper: theme.colors.void } : theme.colors;
  const signal = onVoid ? dark.signal[theme.weather ?? 'fog'] : theme.signal;
  const { setInset } = useContext(InsetContext);
  const bottom = Math.max(insets.bottom, space.sm) + space.xs;

  return (
    <View pointerEvents="box-none" style={[styles.float, { bottom }]} onLayout={e => setInset(e.nativeEvent.layout.height + bottom + space.sm)}>
      <View
        style={[
          styles.tabs,
          {
            backgroundColor: onVoid ? room.glass : theme.colors.chrome,
            borderColor: onVoid ? room.glassEdge : theme.colors.chromeEdge,
            shadowColor: theme.colors.shadow
          }
        ]}
        accessibilityRole="tablist"
      >
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
              style={[styles.tab, focused && { backgroundColor: onVoid ? room.chromeActive : theme.colors.chromeActive }]}
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

// Six names have to fit a 360-point phone with equal gaps; keep the padding lean.
const PAD = space.xs + 2;

const styles = StyleSheet.create({
  float: { position: 'absolute', left: space.sm + 4, right: space.sm + 4 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  tab: {
    minHeight: hitTarget,
    paddingHorizontal: PAD,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs
  },
  label: { fontSize: 11.5, letterSpacing: 0.1 },
  mark: { width: 4, height: 4, borderRadius: radius.dot }
});
