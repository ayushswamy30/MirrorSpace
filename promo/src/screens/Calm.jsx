import { motion, useTransform } from 'framer-motion';

import { Scroll } from '../Phone';
import { Tap } from '../Tap';
import { useBeats, useLocal } from '../timeline';
import { Art, Lede, Row, Section, SubHeader, Txt } from '../ui';

const PATTERNS = [
  ['Double sigh', 'in, a second sip in, a long sigh out — 1 min'],
  ['Box breathing', '4 in · 4 hold · 4 out · 4 hold — 2 min'],
  ['4 · 7 · 8', '4 in · 7 hold · 8 out, for falling asleep — 3 min']
];
const SOUNDS = [
  ['Gentle Rain', 'steady and soft'],
  ['Calm Ocean', 'slow, deep swells'],
  ['Fireplace', 'embers and the odd pop'],
  ['Night Forest', 'crickets and a low breeze'],
  ['Train', 'the rhythm of the rails'],
  ['Library', 'a page now and then']
];

const T_RAIN = 9.6;

/** Calm: breathe out for longer than in; ground yourself; put on a sound. */
export function Calm({ start }) {
  const local = useLocal(start);
  const scale = useTransform(local, [0.4, 3.4, 7.4], [0.5, 1, 0.5], { clamp: true });
  const inOpacity = useTransform(local, [0.4, 0.9, 3.0, 3.5], [0, 1, 1, 0]);
  const outOpacity = useTransform(local, [3.3, 3.8, 6.8, 7.4], [0, 1, 1, 0]);
  const playing = useBeats(start, [T_RAIN]) > 0;
  return (
    <>
      <SubHeader title="calm" right="help" />
      <Scroll start={start} stops={[[7.0, 0], [8.4, 520]]} style={{ gap: 32 }}>
        <Lede label="breathe" title="Breathe out for longer than you breathe in." />
        <div style={{ height: 300, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, border: '1px solid var(--ink)', scale }} />
          <motion.div style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, background: 'var(--band)', scale: useTransform(scale, s => s * 0.92) }} />
          <Art name="swan" size={90} style={{ position: 'relative' }} />
          <motion.div style={{ position: 'absolute', bottom: -6, opacity: inOpacity }}>
            <Txt v="label">breathe in</Txt>
          </motion.div>
          <motion.div style={{ position: 'absolute', bottom: -6, opacity: outOpacity }}>
            <Txt v="label">and out, slowly</Txt>
          </motion.div>
        </div>
        <Section title="breathing">
          {PATTERNS.map(([t, s]) => (
            <Row key={t} title={t} subtitle={s} />
          ))}
        </Section>
        <Section title="grounding">
          <Row title="5 · 4 · 3 · 2 · 1" subtitle="five things you can see, four you can touch…" />
        </Section>
        <Section title="sounds">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 8 }}>
            {SOUNDS.map(([name, note], i) => {
              const on = playing && i === 0;
              return (
                <motion.div
                  key={name}
                  animate={{ backgroundColor: on ? 'var(--ink)' : 'rgba(0,0,0,0)', color: on ? 'var(--paper)' : 'var(--ink)' }}
                  transition={{ duration: 0.4 }}
                  style={{ border: '1px solid var(--ink)', padding: '10px 12px', position: 'relative', minHeight: 64 }}
                >
                  <div style={{ fontFamily: '"Instrument Serif"', fontSize: 19 }}>{name}</div>
                  <div style={{ fontFamily: '"Inter"', fontSize: 12, opacity: 0.7 }}>{note}</div>
                  {on && <Playing />}
                  {i === 0 && <Tap start={start} at={T_RAIN} />}
                </motion.div>
              );
            })}
          </div>
        </Section>
      </Scroll>
    </>
  );
}

function Playing() {
  return (
    <span style={{ position: 'absolute', right: 10, top: 12, display: 'flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ height: [3, 13, 5, 11, 3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          style={{ width: 2, background: 'var(--paper)' }}
        />
      ))}
    </span>
  );
}
