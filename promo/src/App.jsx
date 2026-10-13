import { AnimatePresence, LayoutGroup, motion, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

import { CHAPTERS, CHAPTER_IDS, REST } from './chapters';
import { Phone } from './Phone';
import { Welcome } from './screens/Begin';
import { SCENES, TOTAL, useBeats, useClock, useDerived, useLocal, useSceneIndex } from './timeline';
import { SIGNAL, VOID, dark, ease, easeInOut, fonts, light, signalDark, vars } from './theme';
import { Art, ArtDisc, Dot } from './ui';

export const W = 1920;
export const H = 1080;

/** Fits the 1920×1080 stage to the window when watched live; 1:1 when rendering. */
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

export function App() {
  const fit = useFit();
  const index = useSceneIndex();
  const scene = SCENES[index];
  const chapter = CHAPTERS[scene.id];
  const theme = useSceneTheme(scene, chapter);
  const stageDark = theme === 'void';

  return (
    <div data-total={TOTAL} style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={false}
        animate={{ ...(stageDark ? { ...vars(dark), '--paper': VOID } : vars(light)), backgroundColor: stageDark ? VOID : light.paper }}
        transition={{ duration: 1.1, ease: easeInOut }}
        style={{ width: W, height: H, flex: 'none', position: 'relative', overflow: 'hidden', transform: `scale(${fit})`, ...vars(light) }}
      >
        <LayoutGroup>
          <FilmHeader show={!!chapter} dark={stageDark} />

          <AnimatePresence>{chapter && <Caption key={scene.id} chapter={chapter} number={CHAPTER_IDS.indexOf(scene.id) + 1} />}</AnimatePresence>

          <PhoneRig scene={scene} chapter={chapter} theme={theme} />

          <AnimatePresence>
            {scene.id === 'intro' && <Intro key="intro" start={scene.start} />}
            {scene.id === 'hook' && <Hook key="hook" start={scene.start} />}
            {scene.id === 'outro' && <Outro key="outro" start={scene.start} />}
          </AnimatePresence>

          <ChapterBar active={chapter ? scene.id : null} dark={stageDark} />
        </LayoutGroup>
        <Grain />
      </motion.div>
    </div>
  );
}

function useSceneTheme(scene, chapter) {
  return useDerived(t => {
    const steps = chapter?.theme ?? [[0, 'light']];
    let current = steps[0][1];
    for (const [at, value] of steps) if (t - scene.start >= at * 1000) current = value;
    return current;
  });
}

/* ───────────────────────── the phone and its camera ───────────────────────── */

const PHONE_LEFT = 1110;
const PHONE_TOP = (H - 866) / 2;

function PhoneRig({ scene, chapter, theme }) {
  const poses = chapter?.poses ?? [];
  const beat = useBeats(scene.start, poses.map(p => p[0]));
  let pose = (beat > 0 && poses[beat - 1]?.[1]) || REST;
  if (scene.id === 'intro' || scene.id === 'hook') pose = { x: 0, y: 1150, scale: 1.0, rotate: 6 };
  if (scene.id === 'outro') pose = { x: 30, y: 10, scale: 1.0 };

  const Screen = chapter?.screen;
  const key = chapter ? scene.id : scene.id === 'outro' ? 'outro' : 'begin-pre';

  return (
    <motion.div
      initial={{ x: 0, y: 1150, scale: 1, rotate: 6 }}
      animate={{ rotate: 0, ...pose }}
      transition={{ duration: scene.id === 'begin' ? 1.6 : 1.3, ease: easeInOut }}
      style={{ position: 'absolute', left: PHONE_LEFT, top: PHONE_TOP }}
    >
      <Phone screenKey={key} theme={theme} tab={chapter?.tab}>
        {Screen ? <Screen start={scene.start} /> : <Welcome start={scene.start} still />}
      </Phone>
    </motion.div>
  );
}

/* ───────────────────────────── captions ───────────────────────────── */

const ink = 'var(--ink)';
const soft = 'var(--inkSoft)';

function Caption({ chapter, number }) {
  const words = chapter.title.split(' ');
  return (
    <motion.div
      initial="hidden"
      animate="shown"
      exit={{ opacity: 0, y: -24, filter: 'blur(4px)', transition: { duration: 0.6, ease } }}
      style={{ position: 'absolute', left: 160, top: 0, bottom: 0, width: 780, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34, paddingBottom: 30 }}
    >
      <motion.div variants={rise(0.35)} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: ink }}>{String(number).padStart(2, '0')}</span>
        <motion.span variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1, transition: { duration: 1.1, ease, delay: 0.45 } } }} style={{ width: 70, height: 1, background: ink, originX: 0 }} />
        <span style={{ fontFamily: fonts.mono, fontSize: 16, letterSpacing: 3, color: soft, textTransform: 'uppercase' }}>{chapter.name}</span>
      </motion.div>

      <h1 style={{ margin: 0, fontFamily: fonts.serif, fontWeight: 400, fontSize: 96, lineHeight: '96px', letterSpacing: -1.5, color: ink, maxWidth: 760 }}>
        {words.map((w, i) => (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: 10, marginBottom: -10 }}>
            <motion.span
              variants={{ hidden: { y: '105%' }, shown: { y: '0%', transition: { duration: 1.0, ease, delay: 0.5 + i * 0.07 } } }}
              style={{ display: 'inline-block', marginRight: '0.22em' }}
            >
              {w}
            </motion.span>
          </span>
        ))}
      </h1>

      <motion.p variants={rise(0.95)} style={{ margin: 0, fontFamily: fonts.sans, fontSize: 25, lineHeight: '38px', color: soft, maxWidth: 640 }}>
        {chapter.body}
      </motion.p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 36, maxWidth: 680 }}>
        {chapter.points.map((p, i) => (
          <motion.div
            key={p}
            variants={rise(1.25 + i * 0.12)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: `1px solid ${ink}` }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 8, border: `1px solid ${ink}`, flex: 'none' }} />
            <span style={{ fontFamily: fonts.mono, fontSize: 15, letterSpacing: 2.2, textTransform: 'uppercase', color: ink }}>{p}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={{ hidden: { opacity: 0, rotate: -6, y: 20 }, shown: { opacity: 1, rotate: 0, y: 0, transition: { duration: 1.4, ease, delay: 0.8 } } }}
        style={{ position: 'absolute', right: 20, top: 120 }}
      >
        <motion.div animate={{ y: [0, -6, 0], rotate: [-1, 1.5, -1] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
          <Art name={chapter.art === 'eye' ? 'eye' : chapter.art} size={96} style={{ filter: chapter.art === 'eye' ? 'none' : undefined, opacity: 0.95 }} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const rise = delay => ({
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease, delay } }
});

/** Wordmark and line at the top of the frame, like the app's own header. */
function FilmHeader({ show, dark: isDark }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.8, ease }}
      style={{ position: 'absolute', left: 160, top: 56, display: 'flex', alignItems: 'center', gap: 22 }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 18, letterSpacing: 5, color: ink }}>LOWKEI</span>
        <Dot size={8} color={isDark ? signalDark.overcast : SIGNAL} />
      </span>
      <span style={{ width: 40, height: 1, background: soft }} />
      <span style={{ fontFamily: fonts.mono, fontSize: 13, letterSpacing: 3, color: soft }}>A PRIVATE JOURNAL &amp; MOOD TRACKER</span>
    </motion.div>
  );
}

/** The chapters along the bottom, like the app's tab bar; a hairline fills as the film runs. */
function ChapterBar({ active, dark: isDark }) {
  const time = useClock();
  const first = SCENES.find(s => s.id === CHAPTER_IDS[0]).start;
  const last = SCENES.find(s => s.id === CHAPTER_IDS[CHAPTER_IDS.length - 1]).end;
  const progress = useTransform(time, [first, last], [0, 1], { clamp: true });
  return (
    <motion.div
      initial={false}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 16 }}
      transition={{ duration: 0.9, ease }}
      style={{ position: 'absolute', left: 160, width: 800, bottom: 50 }}
    >
      <div style={{ height: 1, background: 'var(--inkFaint)', position: 'relative', marginBottom: 18 }}>
        <motion.div style={{ position: 'absolute', inset: 0, background: ink, scaleX: progress, originX: 0 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {CHAPTER_IDS.map(id => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <motion.span
              animate={{ color: id === active ? 'var(--ink)' : 'var(--inkSoft)' }}
              transition={{ duration: 0.6 }}
              style={{ fontFamily: fonts.mono, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' }}
            >
              {CHAPTERS[id].name}
            </motion.span>
            {id === active && (
              <motion.span layoutId="chapter-dot" transition={{ duration: 0.9, ease }} style={{ width: 5, height: 5, borderRadius: 5, background: isDark ? signalDark.overcast : SIGNAL }} />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── intro, hook, outro ─────────────────────────── */

const centred = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };

function Intro({ start }) {
  const beat = useBeats(start, [1.5, 2.6]);
  return (
    <motion.div exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)', transition: { duration: 0.9, ease } }} style={{ ...centred, gap: 44 }}>
      <motion.div initial={{ opacity: 0, scale: 0.86, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 1.6, ease, delay: 0.2 }}>
        <motion.div animate={{ y: [0, -8, 0], rotate: [-1.5, 1.5, -1.5] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}>
          <ArtDisc name="eye" size={300} style={{ background: '#fff', boxShadow: '0 30px 60px -30px rgba(0,0,0,.25)' }} />
        </motion.div>
      </motion.div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 50 }}>
        {'LOWKEI'.split('').map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 18 }}
            animate={beat > 0 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease, delay: i * 0.06 }}
            style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 44, letterSpacing: 0, color: ink }}
          >
            {ch}
          </motion.span>
        ))}
        <motion.span initial={{ scale: 0 }} animate={beat > 0 ? { scale: 1 } : {}} transition={{ duration: 0.8, ease, delay: 0.5 }}>
          <Dot size={12} />
        </motion.span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={beat > 1 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 1.1, ease }}
        style={{ fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 46, color: soft, marginTop: -16 }}
      >
        A quiet room, not a clinic.
      </motion.div>
    </motion.div>
  );
}

const HOOK = ['Some days are loud.', 'Some days are heavy.', 'Most of them go unwritten.'];

function Hook({ start }) {
  const beat = useBeats(start, [0.2, 1.3, 2.4, 3.8]);
  return (
    <motion.div exit={{ opacity: 0, y: -30, transition: { duration: 0.8, ease } }} style={{ ...centred }}>
      <AnimatePresence mode="wait">
        {beat < 4 ? (
          <motion.div key="lines" exit={{ opacity: 0, filter: 'blur(8px)', transition: { duration: 0.6 } }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {HOOK.map((line, i) => (
              <motion.div
                key={line}
                initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                animate={beat > i ? { opacity: 1, y: 0, filter: 'blur(0px)', color: beat > i + 1 ? 'var(--inkFaint)' : 'var(--ink)' } : {}}
                transition={{ duration: 1.0, ease }}
                style={{ fontFamily: fonts.serif, fontSize: 104, lineHeight: '116px', letterSpacing: -1.5, color: ink }}
              >
                {line}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="keeps" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <div style={{ fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 128, letterSpacing: -2, color: ink }}>Lowkei keeps them.</div>
            <div style={{ fontFamily: fonts.mono, fontSize: 18, letterSpacing: 4, color: soft }}>QUIETLY · PRIVATELY · FOR YOU ALONE</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Outro({ start }) {
  const local = useLocal(start);
  const card = useTransform(local, [5.6, 6.6], [0, 1], { clamp: true });
  const cardRise = useTransform(card, [0, 1], [14, 0]);
  return (
    <motion.div style={{ position: 'absolute', inset: 0, opacity: 1 }}>
      <motion.div initial="hidden" animate="shown" style={{ position: 'absolute', left: 160, top: 0, bottom: 0, width: 820, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
        <motion.div variants={rise(0.3)} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 30, letterSpacing: 8, color: ink }}>LOWKEI</span>
          <Dot size={10} />
        </motion.div>
        <motion.div variants={rise(0.55)} style={{ fontFamily: fonts.serif, fontSize: 104, lineHeight: '104px', letterSpacing: -1.5, color: ink }}>
          Check in.
          <br />
          Let it out.
          <br />
          <span style={{ fontStyle: 'italic' }}>Breathe.</span>
        </motion.div>
        <motion.div variants={rise(0.95)} style={{ fontFamily: fonts.sans, fontSize: 25, lineHeight: '38px', color: soft, maxWidth: 620 }}>
          A private journal and mood tracker. Every feature free — on Android, and on iPhone as a web app.
        </motion.div>
        <motion.div variants={rise(1.3)} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ background: ink, color: 'var(--paper)', fontFamily: fonts.mono, fontWeight: 500, fontSize: 20, letterSpacing: 3, padding: '20px 30px', display: 'flex', alignItems: 'center', gap: 14 }}>
            GETLOWKEI.VERCEL.APP
            <svg width="18" height="18" viewBox="0 0 16 16">
              <path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke={light.paper} strokeWidth="1.4" />
            </svg>
          </span>
        </motion.div>
      </motion.div>
      {/* The end card: the eye, the name, the address — held still to the last frame. */}
      <motion.div style={{ position: 'absolute', inset: 0, background: light.paper, opacity: card }}>
        <motion.div style={{ ...centred, gap: 34, y: cardRise }}>
          <ArtDisc name="eye" size={220} style={{ background: '#fff', boxShadow: '0 30px 60px -30px rgba(0,0,0,.25)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: fonts.mono, fontWeight: 500, fontSize: 40, letterSpacing: 12, color: light.ink }}>LOWKEI</span>
            <Dot size={11} />
          </span>
          <span style={{ fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 40, color: light.inkSoft, marginTop: -14 }}>A quiet room, not a clinic.</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 18, letterSpacing: 4, color: light.ink, borderTop: `1px solid ${light.ink}`, paddingTop: 18, marginTop: 6 }}>
            GETLOWKEI.VERCEL.APP
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** A faint paper grain over everything — the almanac is printed. */
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
