import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useMotion } from '@/lib/preferences';
import { useTheme } from '@/theme/ThemeProvider';

import { Art, ART_NAMES, type ArtName } from './Art';

/**
 * The reference's loader: one cut-out after another in the middle of the
 * page, about ten a second, like pages of a flipbook. With less motion asked
 * for, it holds a single picture instead of flickering.
 */

const FRAME_MS = 110;

// A fixed, shuffled order, so the sequence reads as a flip rather than a
// slideshow, and so two loaders on screen never beat against each other.
const ORDER: ArtName[] = [...ART_NAMES].sort((a, b) => ((a.charCodeAt(1) * 7) % 11) - ((b.charCodeAt(1) * 7) % 11));

type Props = {
  size?: number;
  /** Fills its parent and centres itself — for a whole page that's loading. */
  fill?: boolean;
  label?: string;
  style?: ViewStyle;
};

export function Loader({ size = 64, fill = false, label = 'Loading', style }: Props) {
  const motion = useMotion();
  const { colors } = useTheme();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (motion === 'still') return;
    const id = setInterval(() => setFrame(f => (f + 1) % ORDER.length), motion === 'gentle' ? FRAME_MS * 4 : FRAME_MS);
    return () => clearInterval(id);
  }, [motion]);

  return (
    <View
      style={[fill ? [styles.fill, { backgroundColor: colors.paper }] : styles.inline, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Art name={motion === 'still' ? 'eye' : ORDER[frame]} size={size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }
});
