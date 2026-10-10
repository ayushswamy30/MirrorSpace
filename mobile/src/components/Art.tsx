import { useId } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { auraFor } from '@/theme/aura';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Sparkles } from './Sparkles';

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

export const ART_NAMES = Object.keys(ART) as ArtName[];

export function isArtName(value: unknown): value is ArtName {
  return typeof value === 'string' && value in ART;
}

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

/**
 * A drawing in a glowing disc, top right of a page: a soft halo in the day's
 * aura colours behind a pale plate, with a few sparkles catching the light.
 */
export function ArtDisc({ name, size = 88, style }: { name: ArtName; size?: number; style?: ViewStyle }) {
  const { colors, scheme, weather } = useTheme();
  const [a, b] = auraFor(weather, scheme);
  const halo = size * 1.9;
  const id = `halo-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View style={[{ width: size, height: size }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View pointerEvents="none" style={{ position: 'absolute', left: (size - halo) / 2, top: (size - halo) / 2, width: halo, height: halo }}>
        <Svg width={halo} height={halo}>
          <Defs>
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={a} stopOpacity={0.85} />
              <Stop offset="0.62" stopColor={b} stopOpacity={0.35} />
              <Stop offset="1" stopColor={b} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={halo} height={halo} fill={`url(#${id})`} />
        </Svg>
      </View>
      <View style={[styles.disc, { width: size, height: size, backgroundColor: colors.disc, borderColor: colors.glassEdge }]}>
        <Art name={name} size={size * 0.72} />
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
  disc: {
    borderRadius: radius.dot,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  }
});
