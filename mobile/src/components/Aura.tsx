import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useMotion } from '@/lib/preferences';
import { auraFor, auraStrength, type AuraName } from '@/theme/aura';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The aura behind a page: four soft glows in the day's colours, drifting on
 * slow, separate clocks and leaning towards a finger on the screen. A new
 * palette fades in over the old one rather than snapping. A fine grain sits
 * over the colour so it reads as light on paper, not a gradient on glass.
 *
 * Motion follows the person's setting: 'gentle' halves the speed, 'still'
 * holds the glows where they are.
 */

type Touch = { x: SharedValue<number>; y: SharedValue<number> };

const TouchContext = createContext<Touch | null>(null);

/** Wraps a page so its aura can follow touches, without taking them. */
export function AuraTouch({ children, style }: { children: ReactNode; style?: object }) {
  const x = useSharedValue(0.5);
  const y = useSharedValue(0.4);
  const size = useRef({ width: 1, height: 1 });
  const motion = useMotion();
  const value = useMemo(() => ({ x, y }), [x, y]);

  const follow = (e: GestureResponderEvent) => {
    if (motion === 'still') return;
    const { locationX, locationY, pageX, pageY } = e.nativeEvent;
    const nx = (pageX ?? locationX) / size.current.width;
    const ny = (pageY ?? locationY) / size.current.height;
    x.set(withSpring(nx, { damping: 30, stiffness: 40 }));
    y.set(withSpring(ny, { damping: 30, stiffness: 40 }));
  };

  return (
    <TouchContext.Provider value={value}>
      <View
        style={style}
        onLayout={(e: LayoutChangeEvent) => (size.current = e.nativeEvent.layout)}
        onTouchStart={follow}
        onTouchMove={follow}
      >
        {children}
      </View>
    </TouchContext.Provider>
  );
}

const BLOBS = [
  { x: 0.12, y: 0.08, r: 0.95, speed: 1.0, phase: 0.0, lean: 0.1 },
  { x: 0.9, y: 0.22, r: 0.85, speed: 0.7, phase: 1.7, lean: -0.08 },
  { x: 0.25, y: 0.62, r: 0.9, speed: 0.55, phase: 3.1, lean: 0.06 },
  { x: 0.85, y: 0.88, r: 0.8, speed: 0.8, phase: 4.4, lean: -0.05 }
];

const CYCLE_MS = 22000;

function Blob({
  index,
  color,
  width,
  height,
  clock
}: {
  index: number;
  color: string;
  width: number;
  height: number;
  clock: SharedValue<number>;
}) {
  const id = `aura-${useId().replace(/[^a-zA-Z0-9]/g, '')}-${index}`;
  const touch = useContext(TouchContext);
  const b = BLOBS[index];
  const size = Math.max(width, height * 0.6) * b.r;

  const style = useAnimatedStyle(() => {
    const t = clock.value * b.speed + b.phase;
    const lx = touch ? (touch.x.value - 0.5) * width * b.lean * 2 : 0;
    const ly = touch ? (touch.y.value - 0.4) * height * b.lean * 2 : 0;
    return {
      transform: [
        { translateX: Math.sin(t) * width * 0.12 + lx },
        { translateY: Math.cos(t * 0.8) * height * 0.06 + ly },
        { scale: 1 + 0.12 * Math.sin(t * 1.3) }
      ]
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: b.x * width - size / 2, top: b.y * height - size / 2, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Layer({ palette, width, height, clock, onShown }: { palette: readonly string[]; width: number; height: number; clock: SharedValue<number>; onShown?: () => void }) {
  const opacity = useSharedValue(onShown ? 0 : 1);
  useEffect(() => {
    if (!onShown) return;
    opacity.value = withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) });
    const done = setTimeout(onShown, 1500);
    return () => clearTimeout(done);
  }, [onShown, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {palette.map((c, i) => (
        <Blob key={i} index={i} color={c} width={width} height={height} clock={clock} />
      ))}
    </Animated.View>
  );
}

export function Aura({ name, room }: { name?: AuraName | null; room?: 'void' }) {
  const { scheme, weather } = useTheme();
  const motion = useMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const clock = useSharedValue(0);

  const palette = useMemo(() => {
    if (room) return auraFor(null, scheme, room);
    if (name && name !== 'dawn' && name !== 'void') return auraFor(name, scheme);
    return auraFor(name === 'dawn' ? null : weather, scheme);
  }, [name, room, scheme, weather]);
  const key = palette.join();

  // The palette on screen, and the one fading in over it.
  const [layers, setLayers] = useState<{ key: string; palette: readonly string[] }[]>([{ key, palette }]);
  if (layers[layers.length - 1].key !== key) setLayers([...layers.slice(-1), { key, palette }]);

  useEffect(() => {
    if (motion === 'still') {
      cancelAnimation(clock);
      return;
    }
    clock.value = withRepeat(
      withTiming(Math.PI * 2, { duration: motion === 'gentle' ? CYCLE_MS * 2 : CYCLE_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(clock);
  }, [motion, clock]);

  const settle = useCallback(() => setLayers(current => current.slice(-1)), []);
  const strength = room ? auraStrength.void : auraStrength[scheme];

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip]}
      onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <View style={[StyleSheet.absoluteFill, { opacity: strength }]}>
          {layers.map((l, i) => (
            <Layer
              key={l.key}
              palette={l.palette}
              width={size.width}
              height={size.height}
              clock={clock}
              onShown={i > 0 ? settle : undefined}
            />
          ))}
        </View>
      )}
      <Grain dark={scheme === 'dark' || room === 'void'} />
    </View>
  );
}

const GRAIN = require('../../assets/images/grain.png');

/** A fine, fixed grain — the paper the light falls on. */
export function Grain({ dark }: { dark: boolean }) {
  return <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: dark ? 0.05 : 0.07 }]} />;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' }
});
