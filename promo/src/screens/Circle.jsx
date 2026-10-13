import { AnimatePresence, motion, useTransform } from 'framer-motion';

import { Scroll } from '../Phone';
import { Tap } from '../Tap';
import { useBeats, useLocal } from '../timeline';
import { SIGNAL, ease } from '../theme';
import { AppHeader, Art, Box, Button, Lede, Row, Section, Txt } from '../ui';

const INK = { clear: 0, mild: 0.25, overcast: 0.5, fog: 0.75, storm: 1 };
const FRIENDS = [
  { name: 'Maya', weather: 'mild' },
  { name: 'Arjun', weather: 'fog', low: true },
  { name: 'Sam', weather: 'clear' },
  { name: 'Noor', weather: 'overcast' },
  { name: 'Leo', weather: 'mild' }
];

const T_OPEN = 4.4;
const T_SEND = 6.1;

/** Circle: a few people who see each other's weather, and nothing else. */
export function Circle({ start }) {
  const sheet = useBeats(start, [T_OPEN + 0.2, 8.0]) === 1;
  const sent = useBeats(start, [T_SEND]) > 0;
  return (
    <>
      <AppHeader />
      <Scroll start={start} stops={[[8.2, 0], [9.6, 560]]} style={{ gap: 28 }}>
        <Lede label="your circle" title="They see your weather, and nothing else." />
        <Orbit start={start} />
        <Section title="running low">
          <Row title="Arjun" subtitle={sent ? 'you sent: thinking of you' : 'running low today'} leading={<Avatar name="Arjun" size={34} />}>
            <Tap start={start} at={T_OPEN} />
          </Row>
        </Section>
        <Section title="your friends">
          {FRIENDS.filter(f => !f.low).map(f => (
            <Row key={f.name} title={f.name} subtitle={`${f.weather} today`} leading={<Avatar name={f.name} size={34} />} arrow={false}>
              <Mark weather={f.weather} />
            </Row>
          ))}
        </Section>
        <Box title="your code" centred>
          <div style={{ fontFamily: '"DM Mono"', fontSize: 30, letterSpacing: 6, padding: '8px 0' }}>LK4·Q7M</div>
          <Button kind="link" label="share it" style={{ alignSelf: 'center' }} />
        </Box>
      </Scroll>
      <AnimatePresence>
        {sheet && (
          <motion.div
            initial={{ y: 320 }}
            animate={{ y: 0 }}
            exit={{ y: 340 }}
            transition={{ duration: 0.75, ease }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--tint)', borderTop: '1px solid var(--ink)', padding: '24px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name="Arjun" size={44} />
              <div>
                <Txt v="heading">Arjun</Txt>
                <Txt v="caption" soft>running low today · foggy</Txt>
              </div>
            </div>
            <Txt soft>They’ll see a quiet note that you’re thinking of them. Nothing else.</Txt>
            {sent ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
                <Txt v="bodyItalic">Sent. Arjun will know.</Txt>
              </motion.div>
            ) : (
              <Button label="thinking of you" arrow>
                <Tap start={start} at={T_SEND} />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function Avatar({ name, size = 40, style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid var(--ink)',
        background: 'var(--paper)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Instrument Serif"',
        fontSize: size * 0.5,
        color: 'var(--ink)',
        flex: 'none',
        ...style
      }}
    >
      {name[0]}
    </div>
  );
}

const Mark = ({ weather, size = 9 }) => (
  <span style={{ width: size, height: size, borderRadius: size, border: '1px solid var(--ink)', background: `rgba(17,17,17,${INK[weather]})`, display: 'inline-block' }} />
);

/** You in the middle; friends on a ring that turns about once every two minutes. */
function Orbit({ start }) {
  const local = useLocal(start);
  const turn = useTransform(local, s => s * 3);
  const counter = useTransform(turn, r => -r);
  const R = 116;
  return (
    <div style={{ alignSelf: 'center', width: 320, height: 320, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 160 - R, top: 160 - R, width: R * 2, height: R * 2, borderRadius: '50%', border: '0.5px solid var(--ink)' }} />
      <div style={{ position: 'absolute', left: 160 - 58, top: 160 - 58, width: 116, height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Art name="kittens" size={84} />
      </div>
      <motion.div style={{ position: 'absolute', inset: 0, rotate: turn }}>
        {FRIENDS.map((f, i) => {
          const a = (i / FRIENDS.length) * Math.PI * 2 - Math.PI / 2;
          const x = 160 + R * Math.cos(a);
          const y = 160 + R * Math.sin(a);
          return (
            <motion.div key={f.name} style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, rotate: counter, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {f.low && (
                <motion.div
                  animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                  style={{ position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: 22, border: `2px solid ${SIGNAL}` }}
                />
              )}
              <Avatar name={f.name} size={44} style={f.low ? { borderColor: SIGNAL, borderWidth: 2 } : undefined} />
              <Txt v="mono" style={{ fontSize: 10 }}>{f.name.toLowerCase()}</Txt>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
