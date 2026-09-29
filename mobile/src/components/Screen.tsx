import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  /** Scrollable by default; a fixed layout (breathing, the lock screen) opts out. */
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
};

/** One idea per screen: a single column with generous margins. */
export function Screen({ children, scroll = true, edges = ['top'], contentStyle }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.paper }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    gap: space.lg
  }
});
