import { motion } from 'framer-motion';

import { Tap } from '../Tap';
import { useBeats, useTyped } from '../timeline';
import { ease } from '../theme';
import { AppHeader, Art, Caret, T, Txt } from '../ui';
import { Swap } from './Swap';

const TOPICS = [
  { key: 'self', art: 'eye', questions: ['Why do I feel like this?', 'Am I being too hard on myself?', 'What keeps coming back?', 'What do I need right now?'] },
  { key: 'love', art: 'heart', questions: [] },
  { key: 'work', art: 'moka', questions: [] },
  { key: 'rest', art: 'swan', questions: ['What would help tonight?', 'What did today take out of me?', 'Why can’t I switch off?', 'What does rest look like for me?'] }
];

const ASK = 'Why can’t I switch off?';
const REPLY =
  'Three of your last five nights started after one, and the days after came out “drained”. Maybe it isn’t that you can’t switch off — the day never gets a clear end. What could a small ending look like tonight?';

const T_REST = 1.5;
const T_ASK = 3.2;
const T_SPEAK = 11.6;

/** Mirror: a dark room — questions by theme, then a conversation. */
export function Mirror({ start }) {
  const talking = useBeats(start, [T_ASK + 0.35]) > 0;
  const listening = useBeats(start, [T_SPEAK]) > 0;
  return (
    <>
      <AppHeader />
      <Swap k={talking ? 1 : 0}>{talking ? <Talk start={start} /> : <Room start={start} />}</Swap>
      <InputBar start={start} listening={listening} />
    </>
  );
}

function Room({ start }) {
  const rest = useBeats(start, [T_REST]) > 0;
  const topic = TOPICS[rest ? 3 : 0];
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ alignSelf: 'center', marginTop: 8 }}>
        <Art name="eye" size={120} />
      </motion.div>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Txt v="label" soft>the mirror</Txt>
        <Txt v="title">What’s on your mind?</Txt>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {TOPICS.map(t => {
          const on = t === topic;
          return (
            <motion.div
              key={t.key}
              animate={{ borderColor: on ? 'var(--ink)' : 'var(--inkFaint)' }}
              transition={{ duration: 0.5, ease }}
              style={{ width: '23%', border: '1px solid', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}
            >
              <div style={{ height: 34, display: 'flex', alignItems: 'center' }}>
                <Art name={t.art} size={30} />
              </div>
              <Txt v="label" soft={!on}>{t.key}</Txt>
              {t.key === 'rest' && <Tap start={start} at={T_REST} />}
            </motion.div>
          );
        })}
      </div>
      <Swap k={topic.key} style={{ minHeight: 230 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {topic.questions.map(q => (
            <div key={q} style={{ padding: '12px 0', borderBottom: '0.5px solid var(--inkFaint)', position: 'relative' }}>
              <Txt v="heading" style={{ fontSize: 20 }}>{q}</Txt>
              {q === ASK && <Tap start={start} at={T_ASK} />}
            </div>
          ))}
        </div>
      </Swap>
    </div>
  );
}

function Talk({ start }) {
  const thinking = useBeats(start, [4.0, 4.9]) === 1;
  const reply = useTyped(start, REPLY, 4.9, 10.2);
  const sources = useBeats(start, [10.4]) > 0;
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Txt v="label" soft style={{ textAlign: 'center' }}>today · 23:48</Txt>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <Txt v="label" soft>you</Txt>
        <Txt v="heading" style={{ textAlign: 'right' }}>{ASK}</Txt>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Txt v="label" soft>mirror</Txt>
        {thinking ? (
          <div style={{ display: 'flex', gap: 6, padding: '8px 0' }}>
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--ink)' }}
              />
            ))}
          </div>
        ) : (
          <div style={{ ...T.body, fontSize: 16, lineHeight: '25px', color: 'var(--ink)' }}>
            <motion.span>{reply}</motion.span>
          </div>
        )}
        {sources && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
            style={{ borderLeft: '1px solid var(--inkFaint)', paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}
          >
            <Txt v="mono" soft>drawn from:</Txt>
            <Txt v="mono" soft>3 late nights this week</Txt>
            <Txt v="mono" soft>“drained” · 4 check-ins</Txt>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function InputBar({ start, listening }) {
  const heard = useTyped(start, 'maybe a walk, then no screens', 12.2, 13.8);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderTop: '0.5px solid var(--inkFaint)', flex: 'none' }}>
      <div style={{ flex: 1, ...T.mono, fontSize: 13, letterSpacing: 1, color: listening ? 'var(--ink)' : 'var(--inkSoft)', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8 }}>
        {listening ? (
          <>
            <Bars />
            <motion.span>{heard}</motion.span>
            <Caret />
          </>
        ) : (
          'ASK ANYTHING…'
        )}
      </div>
      <div style={{ border: '1px solid var(--ink)', padding: '8px 10px', position: 'relative', ...T.action, fontSize: 11 }}>
        {listening ? 'stop' : 'speak'}
        <Tap start={start} at={T_SPEAK} />
      </div>
      <div style={{ ...T.action, fontSize: 11 }}>send</div>
    </div>
  );
}

function Bars() {
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', height: 16 }}>
      {[0, 1, 2, 3].map(i => (
        <motion.span
          key={i}
          animate={{ height: [4, 14, 6, 12, 4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
          style={{ width: 2, background: 'var(--ink)' }}
        />
      ))}
    </span>
  );
}
