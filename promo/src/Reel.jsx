import { AnimatePresence, LayoutGroup, motion, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

import { Phone } from './Phone';
import { REEL, REST, SEGMENTS } from './reelPlan';
import { Welcome } from './screens/Begin';
import { PAGE } from './screens/Vent';
import { Pace, SCENES, TOTAL, useBeats, useClock, useDerived, useLocal, useSceneIndex } from './timeline';
import { SIGNAL, VOID, dark, ease, easeInOut, fonts, light, signalDark, vars } from './theme';
import { ArtDisc, Dot } from './ui';

/**
 * The vertical cut (1080×1920, under a minute). Same app, same ink — but the
 * phone fills the frame and moves on every cut, captions are one line, and a
 * few moments break out of the screen: the word you chose, the page you let
 * go, the Mirror's dark, the breath.
 */
export const W = 1080;
export const H = 1920;

// Where the phone sits: centred, low, so the caption has the top of the frame.
const CX = 540;
const CY = 1180;
const PHONE_W = 412;
const PHONE_H = 866;

function useFit() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / W, innerHeight / H));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  return scale;
}

export function Reel() {
  const fit = useFit();
  const index = useSceneIndex();
  const scene = SCENES[index];
  const conf = REEL[scene.id];
  const theme = useScreenTheme(scene, conf);
  const night = theme === 'void';

  return (
    <div data-total={TOTAL} style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={false}
        animate={night ? { ...vars(dark), '--paper': VOID } : vars(light)}
        transition={{ duration: 0.6, ease }}
        style={{ width: W, height: H, flex: 'none', position: 'relative', overflow: 'hidden', background: light.paper, transform: `scale(${fit})`, ...vars(light) }}
      >
        <LayoutGroup>
          <AnimatePresence>{conf.overlay === 'void' && <VoidRoom key={`void-${scene.id}`} />}</AnimatePresence>

          <Behind scene={scene} conf={conf} />

          <PhoneRig scene={scene} conf={conf} theme={theme} />

          <Above scene={scene} conf={conf} />

          <Progress active={scene.id} night={night} />
          <Caption scene={scene} conf={conf} night={night} />

          <AnimatePresence>
            {scene.id === 'hook' && <Hook key="hook" start={scene.start} />}
            {scene.id === 'outro' && <Outro key="outro" start={scene.start} />}
          </AnimatePresence>
        </LayoutGroup>
        <Grain />
      </motion.div>
    </div>
  );
}

const paceOf = conf => ({ pace: conf.pace ?? 1, from: conf.from ?? 0 });

function useScreenTheme(scene, conf) {
  const { pace, from } = paceOf(conf);
  return useDerived(t => {
    const steps = conf.theme ?? [[0, 'light']];
    const local = ((t - scene.start) * pace) / 1000 + from;
    let current = steps[0][1];
    for (const [at, value] of steps) if (local >= at) current = value;
    return current;
  });
}

/* ───────────────────────────── the phone ───────────────────────────── */

function PhoneRig({ scene, conf, theme }) {
  const poses = conf.poses ?? [[0, REST]];
  const beat = useBeats(scene.start, poses.map(p => p[0]));
  const pose = (beat > 0 && poses[beat - 1]?.[1]) || poses[0][1];
  const Screen = conf.screen;
  const fast = scene.dur <= 1250;

  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2600, pointerEvents: 'none' }}>
      <motion.div
        initial={{ ...REST, y: 1500, rotateX: 30, scale: 1.3 }}
        animate={pose}
        transition={{ duration: fast ? 0.5 : beat <= 1 ? 0.8 : 1.1, ease: easeInOut }}
        style={{ position: 'absolute', left: CX - PHONE_W / 2, top: CY - PHONE_H / 2 }}
      >
        <Phone screenKey={Screen ? scene.id : 'welcome'} theme={theme} tab={conf.tab}>
          <Pace.Provider value={paceOf(conf)}>{Screen ? <Screen start={scene.start} /> : <Welcome start={scene.start} still />}</Pace.Provider>
        </Phone>
      </motion.div>
    </div>
  );
}

/* ───────────────────────────── captions ───────────────────────────── */

function Caption({ scene, conf, night }) {
  return (
    <div style={{ position: 'absolute', left: 64, right: 64, top: 150, height: 380 }}>
      <AnimatePresence mode="wait">
        {conf.title && (
          <motion.div key={scene.id} initial="hidden" animate="shown" exit="gone" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <motion.div
              variants={{ hidden: { opacity: 0, x: -14 }, shown: { opacity: 1, x: 0, transition: { duration: 0.5, ease } }, gone: { opacity: 0, transition: { duration: 0.2 } } }}
              style={{ display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <Dot size={9} color={night ? signalDark.overcast : SIGNAL} />
              <span style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 5, textTransform: 'uppercase', color: 'var(--inkSoft)' }}>{conf.kicker}</span>
            </motion.div>
            <h1 style={{ margin: 0, fontFamily: fonts.serif, fontWeight: 400, fontSize: 104, lineHeight: '104px', letterSpacing: -2, color: 'var(--ink)' }}>
              {conf.title.split(' ').map((w, i) => (
                <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: 12, marginBottom: -12 }}>
                  <motion.span
                    variants={{
                      hidden: { y: '110%', rotate: 4 },
                      shown: { y: '0%', rotate: 0, transition: { duration: 0.6, ease, delay: 0.04 + i * 0.045 } },
                      gone: { y: '-110%', transition: { duration: 0.22, ease: [0.5, 0, 0.75, 0] } }
                    }}
                    style={{ display: 'inline-block', marginRight: '0.2em', originX: 0 }}
                  >
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease, delay: 0.3 } }, gone: { opacity: 0, transition: { duration: 0.15 } } }}
              style={{ fontFamily: fonts.mono, fontSize: 23, letterSpacing: 2.6, textTransform: 'uppercase', color: 'var(--inkSoft)' }}
            >
              {conf.sub}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Stories-style segments across the top, filling as the film runs. */
function Progress({ active, night }) {
  const time = useClock();
  const shown = SEGMENTS.some(seg => seg.includes(active));
  return (
    <motion.div
      initial={false}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      style={{ position: 'absolute', left: 48, right: 48, top: 56, display: 'flex', flexDirection: 'column', gap: 26 }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {SEGMENTS.map(seg => (
          <Segment key={seg[0]} seg={seg} time={time} />
        ))}
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 24, letterSpacing: 6, color: 'var(--ink)' }}>LOWKEI</span>
        <Dot size={8} color={night ? signalDark.overcast : SIGNAL} />
      </span>
    </motion.div>
  );
}

function Segment({ seg, time }) {
  const first = SCENES.find(s => s.id === seg[0]);
  const last = SCENES.find(s => s.id === seg[seg.length - 1]);
  const fill = useTransform(time, [first.start, last.end], [0, 1], { clamp: true });
  return (
    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--inkFaint)', overflow: 'hidden' }}>
      <motion.div style={{ height: '100%', background: 'var(--ink)', scaleX: fill, originX: 0 }} />
    </div>
  );
}

/* ─────────────────────── what breaks out of the phone ─────────────────────── */

function Behind({ scene, conf }) {
  return (
    <AnimatePresence>
      {conf.overlay === 'ghost' && (
        <Pace.Provider key={`ghost-${scene.id}`} value={paceOf(conf)}>
          <Ghost start={scene.start} />
        </Pace.Provider>
      )}
      {conf.overlay === 'rings' && (
        <Pace.Provider key={`rings-${scene.id}`} value={paceOf(conf)}>
          <Rings start={scene.start} />
        </Pace.Provider>
      )}
    </AnimatePresence>
  );
}

function Above({ scene, conf }) {
  return (
    <AnimatePresence>
      {conf.overlay === 'scatter' && (
        <Pace.Provider key={`scatter-${scene.id}`} value={paceOf(conf)}>
          <Scatter start={scene.start} />
        </Pace.Provider>
      )}
    </AnimatePresence>
  );
}

/** The chosen word, huge, behind the phone — it shows past both edges. */
function Ghost({ start }) {
  const on = useBeats(start, [5.45]) > 0;
  return (
    <motion.div exit={{ opacity: 0, transition: { duration: 0.4 } }} style={{ position: 'absolute', left: -200, right: -200, top: CY - 260, display: 'flex', justifyContent: 'center' }}>
      {on && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.0, ease }}
          style={{ fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 360, lineHeight: 1, letterSpacing: -8, color: 'var(--inkFaint)', whiteSpace: 'nowrap' }}
        >
          drained.
        </motion.span>
      )}
    </motion.div>
  );
}

// Seeded, so every render scatters the words the same way.
const scatter = (() => {
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return PAGE.split(' ').map((w, i) => ({
    w,
    x0: 330 + r() * 420,
    y0: CY + 40 + r() * 140,
    x1: 120 + r() * 840,
    y1: 380 + r() * 520,
    rot: (r() - 0.5) * 40,
    delay: i * 0.03
  }));
})();

/** The page you let go: its words lift out of the phone and dissolve into the frame. */
function Scatter({ start }) {
  const gone = useBeats(start, [5.5]) > 0;
  return (
    <motion.div exit={{ opacity: 0, transition: { duration: 0.3 } }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {gone &&
        scatter.map(({ w, x0, y0, x1, y1, rot, delay }, i) => (
          <motion.span
            key={i}
            initial={{ x: x0, y: y0, opacity: 0, rotate: 0, filter: 'blur(0px)' }}
            animate={{ x: x1, y: y1, opacity: [0, 1, 0], rotate: rot, filter: 'blur(7px)' }}
            transition={{ duration: 1.6, ease, delay, opacity: { duration: 1.6, times: [0, 0.15, 1], delay } }}
            style={{ position: 'absolute', left: 0, top: 0, fontFamily: fonts.serif, fontSize: 52, color: 'var(--ink)', whiteSpace: 'nowrap' }}
          >
            {w}
          </motion.span>
        ))}
    </motion.div>
  );
}

/** The Mirror's dark spreads out of the phone to fill the frame. */
function VoidRoom() {
  const from = `circle(0px at ${CX}px ${CY}px)`;
  const to = `circle(${Math.hypot(W, H)}px at ${CX}px ${CY}px)`;
  return (
    <motion.div
      initial={{ clipPath: from }}
      animate={{ clipPath: to }}
      exit={{ clipPath: from, transition: { duration: 0.7, ease: easeInOut } }}
      transition={{ duration: 1.0, ease: easeInOut }}
      style={{ position: 'absolute', inset: 0, background: VOID }}
    />
  );
}

/** The breath, past the phone: rings that swell and settle with the guide. */
function Rings({ start }) {
  const local = useLocal(start);
  const breath = useTransform(local, [0.4, 3.4, 7.4], [0, 1, 0], { clamp: true });
  const y = CY - 75;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} transition={{ duration: 0.6 }} style={{ position: 'absolute', inset: 0 }}>
      {[380, 520, 680, 860].map((r, i) => (
        <Ring key={r} r={r} y={y} breath={breath} i={i} />
      ))}
    </motion.div>
  );
}

function Ring({ r, y, breath, i }) {
  const scale = useTransform(breath, b => 0.62 + b * (0.42 + i * 0.05));
  const opacity = useTransform(breath, b => (0.2 + b * 0.35) * (1 - i * 0.18));
  return (
    <motion.div
      style={{ position: 'absolute', left: CX - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: '1.5px solid var(--ink)', scale, opacity }}
    />
  );
}

/* ───────────────────────────── hook and outro ───────────────────────────── */

function Hook({ start }) {
  const beat = useBeats(start, [0.3, 1.05, 2.5]);
  return (
    <motion.div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 430, gap: 40 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
        animate={beat >= 3 ? { opacity: 0, scale: 0.7, y: -120 } : { opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: beat >= 3 ? 0.6 : 0.9, ease }}
      >
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
          <ArtDisc name="eye" size={250} style={{ background: '#fff', boxShadow: '0 30px 60px -30px rgba(0,0,0,.3)' }} />
        </motion.div>
      </motion.div>
      <div style={{ textAlign: 'center' }}>
        {[
          ['How are you,', false, 1],
          ['really?', true, 2]
        ].map(([line, italic, at]) => (
          <div key={line} style={{ overflow: 'hidden', paddingBottom: 16 }}>
            <motion.div
              initial={{ y: '110%' }}
              animate={beat >= 3 ? { y: '-120%', opacity: 0 } : beat >= at ? { y: '0%' } : {}}
              transition={{ duration: beat >= 3 ? 0.55 : 0.8, ease, delay: beat >= 3 ? at * 0.06 : 0 }}
              style={{ fontFamily: fonts.serif, fontStyle: italic ? 'italic' : 'normal', fontSize: italic ? 200 : 140, lineHeight: 1, letterSpacing: -3, color: 'var(--ink)' }}
            >
              {line}
            </motion.div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Outro({ start }) {
  const local = useLocal(start);
  const card = useTransform(local, [4.1, 4.8], [0, 1], { clamp: true });
  const rise = useTransform(card, [0, 1], [24, 0]);
  const lines = ['Check in.', 'Let it out.', 'Breathe.'];
  return (
    <motion.div style={{ position: 'absolute', inset: 0 }}>
      <motion.div initial="hidden" animate="shown" style={{ position: 'absolute', left: 64, right: 64, top: 170, display: 'flex', flexDirection: 'column', gap: 30 }}>
        <motion.div variants={up(0.1)} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 34, letterSpacing: 9, color: 'var(--ink)' }}>LOWKEI</span>
          <Dot size={11} />
        </motion.div>
        <div>
          {lines.map((l, i) => (
            <div key={l} style={{ overflow: 'hidden', paddingBottom: 10 }}>
              <motion.div
                variants={{ hidden: { y: '110%' }, shown: { y: '0%', transition: { duration: 0.8, ease, delay: 0.2 + i * 0.22 } } }}
                style={{ fontFamily: fonts.serif, fontStyle: i === 2 ? 'italic' : 'normal', fontSize: 130, lineHeight: '128px', letterSpacing: -2.5, color: 'var(--ink)' }}
              >
                {l}
              </motion.div>
            </div>
          ))}
        </div>
        <motion.div variants={up(1.0)} style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: 3, color: 'var(--inkSoft)' }}>
          A PRIVATE JOURNAL &amp; MOOD TRACKER · FREE
        </motion.div>
      </motion.div>

      <motion.div style={{ position: 'absolute', inset: 0, background: light.paper, opacity: card }}>
        <motion.div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, y: rise }}>
          <ArtDisc name="eye" size={300} style={{ background: '#fff', boxShadow: '0 30px 60px -30px rgba(0,0,0,.28)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 58, letterSpacing: 16, color: light.ink }}>LOWKEI</span>
            <Dot size={14} />
          </span>
          <span style={{ fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 58, color: light.inkSoft, marginTop: -16 }}>A quiet room, not a clinic.</span>
          <span style={{ background: light.ink, color: light.paper, fontFamily: fonts.mono, fontWeight: 500, fontSize: 30, letterSpacing: 4, padding: '26px 40px', marginTop: 20 }}>
            GETLOWKEI.VERCEL.APP
          </span>
          <span style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 4, color: light.inkSoft }}>ANDROID · IPHONE (WEB APP) · FREE</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const up = delay => ({
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease, delay } }
});

function Grain() {
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.08 }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}
