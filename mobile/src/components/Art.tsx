import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Halftone cut-outs — the printed almanac's illustrations. Black ink on the
 * light page; at night the dark silhouettes are inverted to light ink, and the
 * mostly-white ones are kept as they are (inverting them reads as a negative).
 *
 * Always decorative: hidden from screen readers, never carrying meaning.
 */

type Pair = { light: ImageSourcePropType; dark: ImageSourcePropType; ratio: number };

const same = (source: ImageSourcePropType, ratio: number): Pair => ({ light: source, dark: source, ratio });

const ART = {
  bandage: { light: require('../../assets/art/bandage.png'), dark: require('../../assets/art/bandage-dark.png'), ratio: 480 / 118 },
  bean: { light: require('../../assets/art/bean.png'), dark: require('../../assets/art/bean-dark.png'), ratio: 366 / 480 },
  beetle: { light: require('../../assets/art/beetle.png'), dark: require('../../assets/art/beetle-dark.png'), ratio: 480 / 324 },
  butterfly: {
    light: require('../../assets/art/butterfly.png'),
    dark: require('../../assets/art/butterfly-dark.png'),
    ratio: 480 / 465
  },
  can: { light: require('../../assets/art/can.png'), dark: require('../../assets/art/can-dark.png'), ratio: 308 / 480 },
  cat: { light: require('../../assets/art/cat.png'), dark: require('../../assets/art/cat-dark.png'), ratio: 395 / 435 },
  city: { light: require('../../assets/art/city.png'), dark: require('../../assets/art/city-dark.png'), ratio: 480 / 273 },
  dice: { light: require('../../assets/art/dice.png'), dark: require('../../assets/art/dice-dark.png'), ratio: 348 / 480 },
  doll: same(require('../../assets/art/doll.png'), 235 / 480),
  eye: same(require('../../assets/art/eye.png'), 478 / 480),
  heart: { light: require('../../assets/art/heart.png'), dark: require('../../assets/art/heart-dark.png'), ratio: 304 / 445 },
  king: { light: require('../../assets/art/king.png'), dark: require('../../assets/art/king-dark.png'), ratio: 192 / 480 },
  kittens: { light: require('../../assets/art/kittens.png'), dark: require('../../assets/art/kittens-dark.png'), ratio: 418 / 480 },
  lily: same(require('../../assets/art/lily.png'), 480 / 455),
  masks: { light: require('../../assets/art/masks.png'), dark: require('../../assets/art/masks-dark.png'), ratio: 480 / 220 },
  moka: same(require('../../assets/art/moka.png'), 379 / 480),
  orchid: same(require('../../assets/art/orchid.png'), 480 / 421),
  stamp: same(require('../../assets/art/stamp.png'), 348 / 335),
  swallow: { light: require('../../assets/art/swallow.png'), dark: require('../../assets/art/swallow-dark.png'), ratio: 253 / 480 },
  swan: same(require('../../assets/art/swan.png'), 468 / 318),
  urchin: { light: require('../../assets/art/urchin.png'), dark: require('../../assets/art/urchin-dark.png'), ratio: 480 / 444 }
} satisfies Record<string, Pair>;

export type ArtName = keyof typeof ART;

/** Today's hero, one a day in turn — the gentler pictures only. */
const DAILY: readonly ArtName[] = ['lily', 'swan', 'orchid', 'butterfly', 'moka', 'bean', 'swallow', 'kittens', 'cat', 'king', 'dice', 'stamp'];

export function artOfTheDay(now: Date = new Date()): ArtName {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return DAILY[day % DAILY.length];
}

type Props = {
  name: ArtName;
  /** The longer side, in points. */
  size: number;
  /** Force a variant — the Mirror room is dark whatever the theme. */
  scheme?: 'light' | 'dark';
  style?: ViewStyle;
};

/** A free-standing cut-out, placed in the margin of a page. */
export function Art({ name, size, scheme, style }: Props) {
  const theme = useTheme();
  const art = ART[name];
  const source = (scheme ?? theme.scheme) === 'dark' ? art.dark : art.light;
  const width = art.ratio >= 1 ? size : size * art.ratio;
  const height = art.ratio >= 1 ? size / art.ratio : size;

  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`art-${name}`}>
      <Image source={source} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

/** The reference's round plate: a cut-out inside a disc, top right of a page. */
export function ArtDisc({ name, size = 88, style }: { name: ArtName; size?: number; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.disc, { width: size, height: size, backgroundColor: colors.disc }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Art name={name} size={size * 0.72} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    borderRadius: radius.dot,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  }
});
