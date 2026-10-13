import { motion } from 'framer-motion';

import { Tap } from '../Tap';
import { useBeats, useTyped } from '../timeline';
import { ease } from '../theme';
import { AppHeader, Art, Button, Caret, Chip, Lede, Segmented, Sheet, Txt } from '../ui';
import { MODES } from './CheckIn';
import { Swap } from './Swap';

export const PAGE = 'I keep saying yes to everything, then resenting everyone for it. I’m tired of being the reliable one.';
const LETTER = 'Dear me, by the time you read this, I hope you’ve learned to rest without earning it first.';

const T_VENT = 0.9;
const T_GO = 5.5;
const T_LETTERS = 7.4;
const T_SIX = 10.5;
const T_SEAL = 11.2;

/** Vent: a page no one reads — kept or let go. Letters: sealed until their day. */
export function Vent({ start }) {
  const mode = useBeats(start, [T_VENT, T_LETTERS]);
  const sealed = useBeats(start, [T_SEAL + 0.4]) > 0;
  return (
    <>
      <AppHeader />
      <div style={{ padding: '0 20px', position: 'relative' }}>
        <Segmented options={MODES} value={MODES[mode]} />
        <div style={{ position: 'absolute', left: 128, top: 0, width: 50, height: 44 }}>
          <Tap start={start} at={T_VENT} />
        </div>
        <div style={{ position: 'absolute', left: 202, top: 0, width: 80, height: 44 }}>
          <Tap start={start} at={T_LETTERS} />
        </div>
      </div>
      <Swap k={sealed ? 3 : mode}>
        {mode === 0 && <Blank />}
        {mode === 1 && <Page start={start} />}
        {mode === 2 && !sealed && <Letter start={start} />}
        {sealed && <Sealed />}
      </Swap>
    </>
  );
}

const Blank = () => <div />;

function Page({ start }) {
  const typed = useTyped(start, PAGE, 1.5, 4.7);
  const gone = useBeats(start, [T_GO]) > 0;
  const words = PAGE.split(' ');
  return (
    <div style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Art name="heart" size={96} style={{ alignSelf: 'flex-end', marginBottom: -16 }} />
      <Lede label="vent" title="Put it down here.">
        <Txt soft>No one reads this. Keep it, or let it go when you’re done.</Txt>
      </Lede>
      <Sheet style={{ minHeight: 170 }}>
        <Txt v="mono" soft>to: whoever it is</Txt>
        <div style={{ fontFamily: '"Inter"', fontSize: 16, lineHeight: '25px' }}>
          {gone ? (
            words.map((w, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                animate={{ opacity: 0, y: -26, filter: 'blur(5px)' }}
                transition={{ duration: 0.9, ease, delay: i * 0.035 }}
                style={{ display: 'inline-block', marginRight: '0.28em' }}
              >
                {w}
              </motion.span>
            ))
          ) : (
            <>
              <motion.span>{typed}</motion.span>
              <Caret />
            </>
          )}
        </div>
      </Sheet>
      {gone ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.9 }}>
          <Txt v="bodyItalic">Let go. It wasn’t saved anywhere.</Txt>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Button label="keep it" />
          <Button kind="outline" label="let go" pressed={false}>
            <Tap start={start} at={T_GO} />
          </Button>
        </div>
      )}
    </div>
  );
}

function Letter({ start }) {
  const typed = useTyped(start, LETTER, 8.0, 10.1);
  const six = useBeats(start, [T_SIX]) > 0;
  const pressed = useBeats(start, [T_SEAL]) > 0;
  return (
    <div style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Lede label="letters" title="A letter to future you.">
        <Txt soft>Sealed on this phone until its day. No one else reads it — including you, until then.</Txt>
      </Lede>
      <Sheet style={{ minHeight: 150 }}>
        <div style={{ fontFamily: '"Instrument Serif"', fontStyle: 'italic', fontSize: 20, lineHeight: '27px' }}>
          <motion.span>{typed}</motion.span>
          <Caret />
        </div>
      </Sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Txt v="label" soft>open it in</Txt>
        <div style={{ display: 'flex', gap: 8 }}>
          {['3 months', '6 months', 'a year'].map(o => (
            <Chip key={o} label={o} selected={(o === '6 months' && six) || (o === '3 months' && !six)}>
              {o === '6 months' && <Tap start={start} at={T_SIX} />}
            </Chip>
          ))}
        </div>
      </div>
      <Button label="seal it" arrow pressed={pressed}>
        <Tap start={start} at={T_SEAL} />
      </Button>
    </div>
  );
}

function Sealed() {
  return (
    <div style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', textAlign: 'center' }}>
      <motion.div initial={{ scale: 0.85, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ duration: 0.9, ease }} style={{ marginTop: 40 }}>
        <Art name="stamp" size={170} />
      </motion.div>
      <Lede label="sealed" title="It’s on its way to you." style={{ alignItems: 'center' }}>
        <Txt v="mono" soft>opens 13 April 2027</Txt>
      </Lede>
      <Button kind="link" label="write another" style={{ alignSelf: 'center' }} />
    </div>
  );
}

