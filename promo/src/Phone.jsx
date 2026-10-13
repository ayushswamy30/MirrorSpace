import { AnimatePresence, cubicBezier, motion, useTransform } from 'framer-motion';

import { useLocal } from './timeline';
import { dark, ease, fonts, light, vars, VOID } from './theme';
import { DarkArt, TabBar } from './ui';

export const SCREEN_W = 390;
export const SCREEN_H = 844;
const BEZEL = 11;

const palettes = {
  light: vars(light),
  dark: vars(dark),
  // The Mirror's room: void black with light ink, in either theme.
  void: { ...vars(dark), '--paper': VOID }
};

/**
 * One phone for the whole film. Its screen swaps with a soft cross-fade and a
 * short rise, as the app's own `useEntering` does; the tab bar stays put so
 * its dot can travel from tab to tab.
 */
export function Phone({ screenKey, theme = 'light', tab, children }) {
  return (
    <div
      style={{
        width: SCREEN_W + BEZEL * 2,
        height: SCREEN_H + BEZEL * 2,
        borderRadius: 62,
        background: '#0c0c0c',
        padding: BEZEL,
        // The faint outer edge keeps the phone's shape against the Mirror's black room.
        boxShadow: '0 0 0 1px rgba(255,255,255,.16), 0 50px 90px -30px rgba(20,20,15,.45), 0 20px 40px -20px rgba(20,20,15,.3), inset 0 0 0 1.5px #3a3a38',
        position: 'relative'
      }}
    >
      <motion.div
        initial={false}
        animate={palettes[theme]}
        transition={{ duration: 0.9, ease }}
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 51,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--paper)',
          color: 'var(--ink)',
          display: 'flex',
          flexDirection: 'column',
          ...palettes[theme]
        }}
      >
        <DarkArt.Provider value={theme !== 'light'}>
          <StatusBar />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <AnimatePresence initial={false}>
              <motion.div
                key={screenKey}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.45, ease } }}
                transition={{ duration: 0.75, ease, delay: 0.15 }}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
          <motion.div initial={false} animate={{ opacity: tab ? 1 : 0, height: tab ? 'auto' : 0 }} transition={{ duration: 0.6, ease }} style={{ overflow: 'hidden', flex: 'none' }}>
            <TabBar active={tab} />
          </motion.div>
        </DarkArt.Provider>
      </motion.div>
      {/* the island */}
      <div style={{ position: 'absolute', top: BEZEL + 11, left: '50%', marginLeft: -62, width: 124, height: 36, borderRadius: 18, background: '#050505' }} />
    </div>
  );
}

function StatusBar() {
  return (
    <div style={{ height: 54, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 34px 0 44px' }}>
      <span style={{ fontFamily: fonts.sans, fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>9:41</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11">
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={i * 4.6} y={8 - i * 2.6} width="3.2" height={3 + i * 2.6} rx="0.8" fill="var(--ink)" />
          ))}
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11">
          <path d="M8 10.5 L5.6 8 A3.4 3.4 0 0 1 10.4 8 Z M3.4 5.9 A6.6 6.6 0 0 1 12.6 5.9 L11.3 7.2 A4.8 4.8 0 0 0 4.7 7.2 Z M1 3.6 A10 10 0 0 1 15 3.6 L13.7 4.9 A8.2 8.2 0 0 0 2.3 4.9 Z" fill="var(--ink)" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.2" fill="none" stroke="var(--ink)" opacity="0.45" />
          <rect x="2.2" y="2.2" width="16" height="7.6" rx="1.8" fill="var(--ink)" />
          <rect x="23.6" y="4" width="1.6" height="4" rx="0.8" fill="var(--ink)" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

const scrollEase = cubicBezier(0.65, 0, 0.35, 1);

/**
 * A scrolling page: `stops` are [seconds, offset] pairs, eased between, so a
 * screen glides down to each section the way a thumb would.
 */
export function Scroll({ start, stops = [[0, 0]], children, style }) {
  const local = useLocal(start);
  const times = stops.map(s => s[0]);
  const offsets = stops.map(s => -s[1]);
  const y = useTransform(local, times.length > 1 ? times : [0, 1], offsets.length > 1 ? offsets : [offsets[0], offsets[0]], {
    ease: scrollEase,
    clamp: true
  });
  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <motion.div style={{ y, padding: '0 20px', display: 'flex', flexDirection: 'column', ...style }}>{children}</motion.div>
    </div>
  );
}
