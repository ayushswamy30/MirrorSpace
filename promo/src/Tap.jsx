import { motion, useTransform } from 'framer-motion';

import { useLocal } from './timeline';

/**
 * A fingertip landing on whatever it sits inside (give the parent
 * `position: relative`). It fades in just before `at`, presses, and leaves
 * a ring that widens and goes — all read from the clock, so it lands on the
 * same frame as the state change it causes.
 */
export function Tap({ start, at, x = '50%', y = '50%', color = '#8C8C86' }) {
  const local = useLocal(start);
  const s = useTransform(local, v => v - at);

  const dotOpacity = useTransform(s, [-0.45, -0.15, 0.25, 0.55], [0, 0.42, 0.42, 0], { clamp: true });
  const dotScale = useTransform(s, [-0.45, -0.05, 0.05, 0.4], [1.5, 1, 0.82, 1], { clamp: true });
  const ringScale = useTransform(s, [0, 0.7], [0.6, 2.6], { clamp: true });
  const ringOpacity = useTransform(s, [-0.01, 0, 0.7], [0, 0.55, 0], { clamp: true });

  const base = { position: 'absolute', left: x, top: y, width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 20, pointerEvents: 'none', zIndex: 20 };
  return (
    <>
      <motion.div style={{ ...base, background: color, opacity: dotOpacity, scale: dotScale }} />
      <motion.div style={{ ...base, border: `1.5px solid ${color}`, opacity: ringOpacity, scale: ringScale }} />
    </>
  );
}
