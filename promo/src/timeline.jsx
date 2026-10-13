import { createContext, useContext, useRef, useState } from 'react';
import { useAnimationFrame, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion';

import { film } from './scenes';

/**
 * The film's clock. Everything that changes over time reads this one motion
 * value — in the browser it runs on real time, and under scripts/render.mjs
 * the page's clock is virtual and stepped one frame at a time, so every
 * Framer Motion transition lands on the same frame on every render.
 *
 *   ?film=reel   the vertical cut (default: the 16:9 promo)
 *   ?t=45000     start the clock 45 s in, for checking a scene
 */

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
export const FILM = params.get('film') === 'reel' ? 'reel' : 'promo';
export const SCENES = film(FILM);
export const TOTAL = SCENES[SCENES.length - 1].end;

export const sceneAt = t => {
  const i = SCENES.findIndex(s => t < s.end);
  return i === -1 ? SCENES.length - 1 : i;
};

const Clock = createContext(null);

export function ClockProvider({ children }) {
  const offset = useRef(Number(params.get('t') ?? 0)).current;
  const time = useMotionValue(offset);
  useAnimationFrame(t => time.set(t + offset));
  return <Clock.Provider value={time}>{children}</Clock.Provider>;
}

export const useClock = () => useContext(Clock);

/**
 * How a screen's own timeline maps onto the film's. The reel plays a screen
 * faster (`pace` 1.6 → 1.6 s of screen time per second) and can join it part
 * way (`from`, in screen seconds), so one screen serves both cuts.
 */
export const Pace = createContext({ pace: 1, from: 0 });

/** Milliseconds of screen time since `start`, under the current pace. */
function useScreenMs() {
  const { pace, from } = useContext(Pace);
  return (t, start) => (t - start) * pace + from * 1000;
}

/**
 * A value read from the clock that re-renders only when it changes. It is
 * computed afresh on every render too, so a component whose inputs just
 * changed (a new scene's start) never sees the old scene's value.
 */
export function useDerived(fn) {
  const time = useClock();
  const [, setValue] = useState(() => fn(time.get()));
  useMotionValueEvent(time, 'change', t => {
    const next = fn(t);
    setValue(prev => (prev === next ? prev : next));
  });
  return fn(time.get());
}

export const useSceneIndex = () => useDerived(sceneAt);

/**
 * How many of a screen's beats have passed. `marks` are seconds of screen
 * time: useBeats(start, [1.2, 3]) is 0, then 1 at 1.2 s, 2 at 3 s.
 */
export function useBeats(start, marks) {
  const ms = useScreenMs();
  return useDerived(t => marks.filter(m => ms(t, start) >= m * 1000).length);
}

/** Seconds of screen time since `start`, as a motion value — for continuous things. */
export function useLocal(start) {
  const time = useClock();
  const ms = useScreenMs();
  return useTransform(time, t => ms(t, start) / 1000);
}

/** Text that types itself between two screen times (seconds). */
export function useTyped(start, text, from, to) {
  const local = useLocal(start);
  return useTransform(local, s => {
    const p = Math.min(1, Math.max(0, (s - from) / (to - from)));
    return text.slice(0, Math.round(p * text.length));
  });
}

export const clamp01 = x => Math.min(1, Math.max(0, x));
