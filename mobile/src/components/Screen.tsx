import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { gutter, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  /** An AppHeader or SubHeader, fixed above the scrolling page. */
  header?: ReactNode;
  /** Scrollable by default; a fixed layout (breathing, the lock screen) opts out. */
  scroll?: boolean;
  edges?: Edge[];
  /** Page background; defaults to paper. */
  background?: string;
  contentStyle?: ViewStyle;
};

/**
 * A single column on paper with the page's side margin. Its direct children
 * are sections, 40 apart; what belongs together goes in one View (or a Lede)
 * with its own tighter gap. That one rhythm is what keeps pages calm.
 */
export function Screen({ children, header, scroll = true, edges = ['top'], background, contentStyle }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background ?? colors.paper }]}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          // Keeps a focused text field (the check-in note) above the keyboard.
          automaticallyAdjustKeyboardInsets
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
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.xl
  }
});
