import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Aura, AuraTouch } from '@/components/Aura';
import { useTabInset } from '@/components/TabBar';
import type { AuraName } from '@/theme/aura';
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
  /** The glow behind the page: today's weather by default, a fixed one, or none. */
  aura?: AuraName | false;
  /** The Mirror's dark room keeps its own cosmic aura in both themes. */
  room?: 'void';
};

/**
 * A single column on paper with the page's side margin, lit from behind by
 * the day's aura. Its direct children are sections, 40 apart; what belongs
 * together goes in one View (or a Lede) with its own tighter gap. That one
 * rhythm is what keeps pages calm.
 */
export function Screen({ children, header, scroll = true, edges = ['top'], background, contentStyle, aura, room }: Props) {
  const { colors } = useTheme();
  // Room for the floating tab bar, on pages inside the tabs.
  const tabInset = useTabInset();

  return (
    <AuraTouch style={[styles.root, { backgroundColor: background ?? colors.paper }]}>
      <SafeAreaView edges={edges} style={styles.root}>
        {aura !== false && <Aura name={aura || null} room={room} />}
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle, tabInset ? { paddingBottom: space.xxl + tabInset } : null]}
            keyboardShouldPersistTaps="handled"
            // Keeps a focused text field (the check-in note) above the keyboard.
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, contentStyle, tabInset ? { paddingBottom: tabInset } : null]}>{children}</View>
        )}
      </SafeAreaView>
    </AuraTouch>
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
