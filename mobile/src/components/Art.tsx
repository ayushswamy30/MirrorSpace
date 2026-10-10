import { useId } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { auraFor } from '@/theme/aura';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Sparkles } from './Sparkles';

/**
 * Glowing drawings: the engravings recoloured as iridescent light, each with
 * its own pair of hues and a soft halo (scripts/art/glow.py). One file reads
 * on both the light page and the night.
 *
 * Always decorative: hidden from screen readers, never carrying meaning.
 */

type Pair = { light: ImageSourcePropType; dark: ImageSourcePropType; ratio: number };

const same = (source: ImageSourcePropType, ratio: number): Pair => ({ light: source, dark: source, ratio });

const ART = {
  bandage: same(require('../../assets/art-glow/bandage.png'), 614 / 252),
  bean: same(require('../../assets/art-glow/bean.png'), 500 / 614),
  beetle: same(require('../../assets/art-glow/beetle.png'), 614 / 458),
  butterfly: same(require('../../assets/art-glow/butterfly.png'), 614 / 599),
  can: same(require('../../assets/art-glow/can.png'), 442 / 614),
  cat: same(require('../../assets/art-glow/cat.png'), 515 / 555),
  city: same(require('../../assets/art-glow/city.png'), 614 / 407),
  dice: same(require('../../assets/art-glow/dice.png'), 482 / 614),
  doll: same(require('../../assets/art-glow/doll.png'), 369 / 614),
  eye: same(require('../../assets/art-glow/eye.png'), 612 / 614),
  heart: same(require('../../assets/art-glow/heart.png'), 428 / 569),
  king: same(require('../../assets/art-glow/king.png'), 326 / 614),
  kittens: same(require('../../assets/art-glow/kittens.png'), 552 / 614),
  lily: same(require('../../assets/art-glow/lily.png'), 614 / 589),
  masks: same(require('../../assets/art-glow/masks.png'), 614 / 354),
  moka: same(require('../../assets/art-glow/moka.png'), 513 / 614),
  orchid: same(require('../../assets/art-glow/orchid.png'), 614 / 555),
  stamp: same(require('../../assets/art-glow/stamp.png'), 444 / 431),
  swallow: same(require('../../assets/art-glow/swallow.png'), 387 / 614),
  swan: same(require('../../assets/art-glow/swan.png'), 598 / 448),
  urchin: same(require('../../assets/art-glow/urchin.png'), 614 / 578)
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
