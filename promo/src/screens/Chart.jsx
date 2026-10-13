import { motion, useTransform } from 'framer-motion';

import { Scroll } from '../Phone';
import { useBeats, useLocal } from '../timeline';
import { SIGNAL, ease } from '../theme';
import { AppHeader, Art, Box, Button, Chip, Lede, Row, Section, SubHeader, Txt } from '../ui';
import { Swap } from './Swap';

const W = ['clear', 'mild', 'overcast', 'fog', 'storm'];
const INK = { clear: 0, mild: 0.25, overcast: 0.5, fog: 0.75, storm: 1 };
// A made-up month: oldest first, null for a day without a check-in.
const MONTH = 'mmcocoo-ffoscm-cmoof-ooms-cmmo'.split('').map(ch => ({ c: 'clear', m: 'mild', o: 'overcast', f: 'fog', s: 'storm' })[ch] ?? null);
const CHECKED = MONTH.filter(Boolean).length;
const OVERCAST = MONTH.filter(w => w === 'overcast').length;
const WORDS = [
  ['drained', 30],
  ['calm', 26],
  ['tired', 22],
  ['hopeful', 19],
  ['on edge', 17],
  ['content', 16],
  ['low', 14],
  ['proud', 13],
  ['restless', 12]
];
const TAGS = [
  ['work', 14],
  ['sleep', 11],
  ['friends', 8],
  ['family', 6],
  ['outside', 5]
];
const NIGHTS = [7.2, 6.1, 5.4, 7.8, 6.6, 5.2, 8.1, 7.0, 6.4, 5.8, 7.5, 6.9, 4.9, 6.2, 7.7, 7.1, 6.0, 5.6, 8.3, 7.4, 6.8, 6.1, 7.9, 5.9];

const T_WRAPPED = 9.7;
const T_EXPERIMENTS = 12.0;

export function Chart({ start }) {
  const page = useBeats(start, [T_WRAPPED, T_EXPERIMENTS]);
  return (
    <Swap k={page}>
      {page === 0 && <Month start={start} />}
      {page === 1 && <Wrapped start={start} />}
      {page === 2 && <Experiments />}
    </Swap>
  );
}

function Month({ start }) {
  return (
    <>
      <AppHeader />
      <Scroll
        start={start}
        stops={[
          [0, 0],
          [4.2, 0],
          [5.8, 600],
          [7.0, 600],
          [8.4, 1000]
        ]}
        style={{ gap: 32 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 20, rowGap: 4 }}>
          {['this week, in reflection', 'your mind chart', 'wrapped', 'experiments'].map(l => (
            <Button key={l} kind="link" label={l} style={{ fontSize: 11 }} />
          ))}
        </div>
        <Lede label="your chart" title="The last thirty days.">
          <Txt soft>{`Mostly overcast — ${OVERCAST} of the ${CHECKED} days you checked in.`}</Txt>
        </Lede>
        <Section title="weather, day by day">
          <Wheel start={start} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {W.map(w => (
              <span key={w} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, border: '1px solid var(--ink)', background: `rgba(17,17,17,${INK[w]})` }} />
                <Txt v="mono" soft style={{ fontSize: 11 }}>{w}</Txt>
              </span>
            ))}
          </div>
        </Section>
        <Art name="beetle" size={96} style={{ alignSelf: 'flex-end' }} />
        <Box title="words you reach for" centred>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: 14, rowGap: 2 }}>
            {WORDS.map(([w, size]) => (
              <span key={w} style={{ fontFamily: '"Instrument Serif"', fontSize: size, lineHeight: 1.15, color: 'var(--ink)' }}>
                {w}
              </span>
            ))}
          </div>
        </Box>
        <Box title="around your days">
          {TAGS.map(([tag, n]) => (
            <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <Txt v="mono" style={{ width: 62 }}>{tag}</Txt>
              <div style={{ flex: 1, height: 1, background: 'var(--band)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: -2, height: 5, width: `${(n / 14) * 100}%`, background: 'var(--ink)' }} />
              </div>
              <Txt v="mono" soft style={{ width: 22, textAlign: 'right' }}>{n}</Txt>
            </div>
          ))}
        </Box>
        <Section title="nights">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8 }}>
            <Txt v="title">6h 42m</Txt>
            <Txt v="mono" soft>average · 24 nights · 6 under 6h</Txt>
          </div>
          <Skyline start={start} />
        </Section>
      </Scroll>
    </>
  );
}

/** Thirty days around a ring, clockwise from the top; today wears the signal. */
function Wheel({ start }) {
  const local = useLocal(start);
  const size = 300;
  const mid = size / 2;
  const ring = mid - 26;
  const at = (i, r) => {
    const a = ((i + 0.5) / MONTH.length) * Math.PI * 2 - Math.PI / 2;
    return [mid + r * Math.cos(a), mid + r * Math.sin(a)];
  };
  const today = at(MONTH.length - 1, ring + 20);
  const centre = useTransform(local, [2.6, 3.4], [0, 1]);
  return (
    <div style={{ alignSelf: 'center', position: 'relative', width: size, height: size, margin: '8px 0' }}>
      <svg width={size} height={size}>
        <circle cx={mid} cy={mid} r={ring - 18} stroke="var(--ink)" strokeWidth="0.5" fill="none" />
        <circle cx={mid} cy={mid} r={ring + 22} stroke="var(--ink)" strokeWidth="0.5" fill="none" />
        <line x1={mid} y1={mid - ring - 22} x2={mid} y2={mid - ring + 18} stroke="var(--ink)" strokeWidth="0.5" />
        {MONTH.map((w, i) => (
          <Day key={i} local={local} i={i} pos={at(i, ring)} weather={w} />
        ))}
        <motion.circle cx={today[0]} cy={today[1]} r="3.5" fill={SIGNAL} style={{ opacity: centre }} />
      </svg>
      <motion.div style={{ opacity: centre, position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Txt v="mono" soft>mostly</Txt>
        <Txt v="title">overcast</Txt>
      </motion.div>
    </div>
  );
}

function Day({ local, i, pos, weather }) {
  const t0 = 0.5 + i * 0.07;
  const scale = useTransform(local, [t0, t0 + 0.45], [0, 1], { clamp: true });
  return (
    <motion.g style={{ scale, originX: `${pos[0]}px`, originY: `${pos[1]}px` }}>
      {weather ? (
        <circle cx={pos[0]} cy={pos[1]} r="7.5" stroke="var(--ink)" strokeWidth="1" fill={`rgba(17,17,17,${INK[weather]})`} />
      ) : (
        <circle cx={pos[0]} cy={pos[1]} r="1.6" fill="var(--ink)" />
      )}
    </motion.g>
  );
}

function Skyline({ start }) {
  const local = useLocal(start);
  const grow = useTransform(local, [7.2, 8.8], [0, 1], { clamp: true });
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110, borderBottom: '1px solid var(--ink)', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: (6 / 9) * 110, borderTop: '0.5px dashed var(--inkSoft)' }} />
      {NIGHTS.map((h, i) => (
        <motion.div key={i} style={{ flex: 1, height: (h / 9) * 110, background: h < 6 ? 'var(--ink)' : 'var(--inkSoft)', scaleY: grow, originY: 1 }} />
      ))}
    </div>
  );
}

function Count({ start, to, from, until }) {
  const local = useLocal(start);
  const n = useTransform(local, [from, until], [0, to], { clamp: true });
  const text = useTransform(n, v => String(Math.round(v)));
  return <motion.span>{text}</motion.span>;
}

function Wrapped({ start }) {
  const s = T_WRAPPED + 0.4;
  return (
    <>
      <SubHeader title="wrapped" />
      <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Lede label="wrapped · september" title="September, wrapped." big>
          <Txt soft>What you wrote down, told back. Counts and plain facts — no scores.</Txt>
        </Lede>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--ink)' }}>
          {[
            ['check-ins', 41],
            ['pages kept', 12],
            ['nights logged', 24],
            ['longest run', 9]
          ].map(([label, n], i) => (
            <div key={label} style={{ padding: 16, borderRight: i % 2 === 0 ? '1px solid var(--ink)' : 'none', borderBottom: i < 2 ? '1px solid var(--ink)' : 'none' }}>
              <div style={{ fontFamily: '"Instrument Serif"', fontSize: 52, lineHeight: '56px' }}>
                <Count start={start} to={n} from={s + 0.2} until={s + 1.4} />
              </div>
              <Txt v="label" soft>{label}</Txt>
            </div>
          ))}
        </div>
        <Row title="Your word: “calm”" subtitle="nine times, mostly on weekends" arrow={false} />
      </div>
    </>
  );
}

function Experiments() {
  return (
    <>
      <SubHeader title="experiments" />
      <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Art name="dice" size={90} style={{ alignSelf: 'flex-end' }} />
        <Lede label="experiments" title="Try one small change for a week.">
          <Txt soft>Then see the week before and the week of it, side by side.</Txt>
        </Lede>
        <Section title="choose one">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            {['No phone after 22:00', 'In bed by 23:30', 'A walk after lunch'].map((p, i) => (
              <Chip key={p} label={p} selected={i === 0} />
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
