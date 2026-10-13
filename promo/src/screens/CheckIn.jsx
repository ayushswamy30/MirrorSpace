import { motion } from 'framer-motion';

import { Scroll } from '../Phone';
import { Tap } from '../Tap';
import { useBeats, useTyped } from '../timeline';
import { ease } from '../theme';
import { AppHeader, Art, Button, Caret, Chip, Lede, Section, Segmented, Sheet, Txt, WeatherMark } from '../ui';
import { Swap } from './Swap';

export const MODES = ['check in', 'vent', 'letters'];

const MOODS = [
  { title: 'Wound up', hint: 'tense · uneasy · on edge', art: 'urchin' },
  { title: 'Bright', hint: 'lively · glad · focused', art: 'butterfly' },
  { title: 'Heavy', hint: 'tired · low · drained', art: 'can' },
  { title: 'Easy', hint: 'calm · content · settled', art: 'lily' }
];

const HEAVY = ['tired', 'drained', 'low', 'down', 'exhausted', 'sad', 'sluggish', 'empty', 'numb', 'burnt out'];
const TAGS = ['work', 'sleep', 'family', 'partner', 'friends', 'alone', 'study', 'money', 'movement', 'food', 'health', 'home', 'outside', 'travel'];
const NOTE = 'Long week. Slept badly again.';

const T_MOOD = 2.6;
const T_WORD = 5.4;
const T_DONE = 12.5;

/** Check-in: a mood, the closest word — saved on that tap — then what's around it. */
export function CheckIn({ start }) {
  const step = useBeats(start, [T_MOOD + 0.35, T_WORD + 0.35, T_DONE + 0.35]);
  return (
    <>
      <AppHeader />
      <Swap k={step}>
        {step === 0 && <Moods start={start} />}
        {step === 1 && <Words start={start} />}
        {step === 2 && <After start={start} />}
        {step === 3 && <Moods start={start} last />}
      </Swap>
    </>
  );
}

function Head({ last }) {
  return (
    <>
      <Segmented options={MODES} value="check in" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        <div style={{ alignSelf: 'flex-end', marginBottom: -24 }}>
          <WeatherMark color="var(--inkSoft)" size={10} />
        </div>
        <Lede label="name it" title="Where are you, right now?">
          <Txt v="mono" soft>{last ? 'last: drained · 21:14' : 'last: calm · yesterday'}</Txt>
        </Lede>
      </div>
    </>
  );
}

function Moods({ start, last }) {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Head last={last} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {MOODS.map((m, i) => (
          <motion.div
            key={m.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.25 + i * 0.08 }}
            style={{
              width: 'calc(50% - 4px)',
              border: '0.5px solid var(--ink)',
              padding: '24px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              position: 'relative'
            }}
          >
            <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
              <Art name={m.art} size={56} />
            </div>
            <Txt v="heading">{m.title}</Txt>
            <Txt v="mono" soft style={{ textAlign: 'center' }}>{m.hint}</Txt>
            {!last && i === 2 && <Tap start={start} at={T_MOOD} />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Words({ start }) {
  const chosen = useBeats(start, [T_WORD]) > 0;
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Head />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Art name="can" size={40} />
        <div>
          <Txt v="label" soft>Heavy</Txt>
          <Txt v="bodyItalic">Which word is closest?</Txt>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {HEAVY.map((w, i) => (
          <motion.div key={w} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.2 + i * 0.05 }}>
            <Chip label={w} selected={chosen && w === 'drained'}>
              {w === 'drained' && <Tap start={start} at={T_WORD} />}
            </Chip>
          </motion.div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <Button kind="link" label="more words" />
        <Button kind="link" label="another mood" />
      </div>
    </div>
  );
}

function After({ start }) {
  const tagged = useBeats(start, [7.4, 8.1]);
  const note = useTyped(start, NOTE, 9.3, 11.4);
  const pressed = useBeats(start, [T_DONE]) > 0;
  return (
    <Scroll start={start} stops={[[8.5, 0], [9.2, 236]]} style={{ gap: 24 }}>
      <Art name="lily" size={112} style={{ alignSelf: 'flex-end' }} />
      <Lede label="checked in" title="drained.">
        <Txt soft>That’s the check-in. Anything around it?</Txt>
      </Lede>
      <Section title="around it">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
          {TAGS.map((tag, i) => (
            <Chip key={tag} label={tag} selected={(i === 0 && tagged > 0) || (i === 1 && tagged > 1)} style={{ fontSize: 17, minHeight: 40, padding: '0 13px' }}>
              {i < 2 && <Tap start={start} at={7.4 + i * 0.7} />}
            </Chip>
          ))}
        </div>
      </Section>
      <Sheet prompt="A line about it, if you want.">
        <div style={{ fontFamily: '"Inter"', fontSize: 15, lineHeight: '23px', minHeight: 60 }}>
          <motion.span>{note}</motion.span>
          <Caret />
        </div>
      </Sheet>
      <Button label="done" arrow pressed={pressed}>
        <Tap start={start} at={T_DONE} />
      </Button>
      <Button kind="link" label="a different word" />
    </Scroll>
  );
}
