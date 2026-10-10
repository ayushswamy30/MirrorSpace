import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Aura, AuraTouch } from '@/components/Aura';
import { useTabInset } from '@/components/TabBar';
import type { AuraName } from '@/theme/aura';
import { sceneForWeather, sceneImage, type SceneName } from '@/theme/scenes';
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
  /**
   * The sky the page opens under: a scene band at the top, with the page on a
   * soft sheet that slides up over it. 'weather' follows the day.
   */
  scene?: SceneName | 'weather';
  /** A scene behind the whole page instead of a band (the Mirror). */
  backdrop?: SceneName;
};

const SHEET_RADIUS = 32;

/**
 * A single column with the page's side margin. Most pages open under a scene
 * — the day's sky — and sit on a paper sheet that slides up over it, so text
 * is always on paper, never on the artwork. Behind both, the day's aura.
 * Its direct children are sections, 40 apart.
 */
export function Screen({ children, header, scroll = true, edges = ['top'], background, contentStyle, aura, room, scene, backdrop }: Props) {
  const { colors, scheme, weather } = useTheme();
  const { height } = useWindowDimensions();
  // Room for the floating tab bar, on pages inside the tabs.
  const tabInset = useTabInset();

  const sceneName = scene === 'weather' ? sceneForWeather(weather) : scene;
  const band = sceneName ? Math.round(Math.min(380, Math.max(240, height * 0.36))) : 0;
  const bottom = tabInset ? { paddingBottom: (scroll ? space.xxl : 0) + tabInset } : null;

  const sheetStyle = sceneName
    ? [styles.sheet, { backgroundColor: scheme === 'dark' ? 'rgba(12,11,22,0.9)' : 'rgba(247,246,250,0.9)' }]
    : null;

  return (
    <AuraTouch style={[styles.root, { backgroundColor: background ?? colors.paper }]}>
      {aura !== false && <Aura name={aura || null} room={room} />}
      {backdrop && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={sceneImage(backdrop)} style={styles.fillImage} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,6,26,0.45)' }]} />
        </View>
      )}
      {sceneName && (
        <View pointerEvents="none" style={[styles.band, { height: band }]}>
          <Image source={sceneImage(sceneName, 'wide')} style={styles.fillImage} resizeMode="cover" />
          {scheme === 'dark' && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,11,22,0.38)' }]} />}
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="band-fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.7" stopColor={colors.paper} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.paper} stopOpacity={0.9} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#band-fade)" />
          </Svg>
        </View>
      )}
      <SafeAreaView edges={edges} style={styles.root}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[sceneName ? { paddingTop: band - SHEET_RADIUS } : null, !sceneName && styles.content, !sceneName && contentStyle, !sceneName && bottom]}
            keyboardShouldPersistTaps="handled"
            // Keeps a focused text field (the check-in note) above the keyboard.
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {sceneName ? <View style={[styles.content, sheetStyle, contentStyle, bottom]}>{children}</View> : children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, sceneName ? { paddingTop: band - SHEET_RADIUS } : null]}>
            <View style={[styles.content, styles.fill, sheetStyle, contentStyle, bottom]}>{children}</View>
          </View>
        )}
      </SafeAreaView>
    </AuraTouch>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  band: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Explicit size: on the web an absolutely placed Image otherwise keeps its own.
  fillImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  sheet: { borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, paddingTop: space.lg + 4, minHeight: 600 },
  content: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.xl
  }
});
