import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Sparkles } from './Sparkles';

/**
 * The app's pictures: the sticker slots in assets/pictures (scripts/pictures.py),
 * shown as soft rounded stickers. The names are the ones the app has always
 * used — circle pictures are stored by name on the server — each now pointing
 * at the image that suits it.
 *
 * Always decorative: hidden from screen readers, never carrying meaning.
 */

const ART = {
  bandage: require('../../assets/pictures/sticker-orchid.webp'),
  bean: require('../../assets/pictures/sticker-jelly-cat.webp'),
  beetle: require('../../assets/pictures/sticker-butterfly.webp'),
  butterfly: require('../../assets/pictures/sticker-butterfly.webp'),
  can: require('../../assets/pictures/sticker-ghost.webp'),
  cat: require('../../assets/pictures/sticker-jelly-cat.webp'),
  city: require('../../assets/pictures/sticker-sun.webp'),
  dice: require('../../assets/pictures/sticker-butterfly.webp'),
  doll: require('../../assets/pictures/sticker-star-child.webp'),
  eye: require('../../assets/pictures/sticker-eye.webp'),
  heart: require('../../assets/pictures/sticker-cherries.webp'),
  king: require('../../assets/pictures/sticker-star-child.webp'),
  kittens: require('../../assets/pictures/sticker-ghost.webp'),
  lily: require('../../assets/pictures/sticker-lily.webp'),
  masks: require('../../assets/pictures/sticker-eye.webp'),
  moka: require('../../assets/pictures/sticker-sun.webp'),
  orchid: require('../../assets/pictures/sticker-orchid.webp'),
  stamp: require('../../assets/pictures/sticker-flower-frame.webp'),
  swallow: require('../../assets/pictures/sticker-cloud.webp'),
  swan: require('../../assets/pictures/sticker-koi.webp'),
  urchin: require('../../assets/pictures/sticker-cherries.webp')
} satisfies Record<string, ImageSourcePropType>;

export type ArtName = keyof typeof ART;

export const ART_NAMES = Object.keys(ART) as ArtName[];

export function isArtName(value: unknown): value is ArtName {
  return typeof value === 'string' && value in ART;
}

/** Today's picture, one a day in turn — the gentler ones only. */
const DAILY: readonly ArtName[] = ['lily', 'swan', 'orchid', 'butterfly', 'moka', 'bean', 'swallow', 'kittens', 'cat', 'king', 'stamp', 'eye'];

export function artOfTheDay(now: Date = new Date()): ArtName {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return DAILY[day % DAILY.length];
}

export function artImage(name: ArtName): ImageSourcePropType {
  return ART[name];
}

type Props = {
  name: ArtName;
  /** Width and height, in points. */
  size: number;
  /** Kept for callers on the dark Mirror room; the pictures read on both. */
  scheme?: 'light' | 'dark';
  style?: ViewStyle;
};

/** A picture as a soft rounded sticker. */
export function Art({ name, size, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.sticker, { width: size, height: size, borderRadius: size * 0.28, borderColor: colors.glassEdge }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`art-${name}`}
    >
      <Image source={ART[name]} style={styles.fill} resizeMode="cover" />
    </View>
  );
}

/** A picture in a round, glowing disc, top right of a page, with a few sparkles. */
export function ArtDisc({ name, size = 88, style }: { name: ArtName; size?: number; style?: ViewStyle }) {
  const { colors, signal } = useTheme();

  return (
    <View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.disc, { width: size, height: size, borderColor: colors.glassEdge, shadowColor: signal }]}>
        <Image source={ART[name]} style={styles.fill} resizeMode="cover" />
      </View>
      <Sparkles
        sparks={[
          { x: 0.02, y: 0.18, size: size * 0.16 },
          { x: 0.96, y: 0.86, size: size * 0.12, delay: 2.1 },
          { x: 0.88, y: 0.04, size: size * 0.09, delay: 4 }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  sticker: { overflow: 'hidden', borderWidth: 1 },
  disc: {
    borderRadius: radius.dot,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10
  }
});
