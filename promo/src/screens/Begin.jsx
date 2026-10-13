import { motion } from 'framer-motion';

import { Tap } from '../Tap';
import { useBeats, useDerived } from '../timeline';
import { ease } from '../theme';
import { AppHeader, ArtDisc, Art, Button, Chip, Lede, Txt } from '../ui';
import { Swap } from './Swap';

const INTENTS = ['understand why I feel the way I do', 'feel less on edge', 'sleep and rest better', 'somewhere to put things down'];
const CODE = '482017';

/** Onboarding: welcome → six-digit code → what brings you here → lock. */
export function Begin({ start }) {
  const step = useBeats(start, [2.4, 5.1, 7.9]);
  return (
    <>
      <AppHeader left={false} />
      <Swap k={step}>
        {step === 0 && <Welcome start={start} />}
        {step === 1 && <Code start={start} />}
        {step === 2 && <Intents start={start} />}
        {step === 3 && <Lock start={start} />}
      </Swap>
    </>
  );
}

export function Welcome({ start, still }) {
  const pressed = useBeats(start, [1.95]) > 0 && !still;
  return (
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 40, height: '100%' }}>
      <ArtDisc name="eye" size={150} style={{ alignSelf: 'flex-end', marginTop: 10 }} />
      <Lede label="lowkei" title="A quiet room, not a clinic." big>
        <Txt>Check in, vent, talk to the Mirror, and see the weather of your weeks. What you write stays on this phone.</Txt>
      </Lede>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto', marginBottom: 40 }}>
        <Button label="create an account" arrow pressed={pressed}>
          {!still && <Tap start={start} at={1.95} />}
        </Button>
        <Button kind="link" label="I already have an account" />
      </div>
    </div>
  );
}

function Code({ start }) {
  const typed = useDerived(t => Math.max(0, Math.min(6, Math.floor((t - start - 2400 - 650) / 230))));
  return (
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <Lede label="check your inbox" title="Type the six digits.">
        <Txt soft>We sent a code to you@example.com. No passwords, ever.</Txt>
      </Lede>
      <div style={{ display: 'flex', gap: 8 }}>
        {CODE.split('').map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 60,
              borderBottom: `1.5px solid ${i === typed ? 'var(--ink)' : 'var(--inkFaint)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {i < typed && (
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} style={{ fontFamily: '"DM Mono"', fontSize: 30 }}>
                {d}
              </motion.span>
            )}
          </div>
        ))}
      </div>
      <Button kind="link" label="use a different email" />
    </div>
  );
}

function Intents({ start }) {
  const picked = useBeats(start, [6.0, 6.7]);
  const pressed = useBeats(start, [7.45]) > 0;
  return (
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Lede label="1 of 4" title="What brings you here?">
        <Txt soft>Choose any, or none. You can change this later.</Txt>
      </Lede>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INTENTS.map((intent, i) => {
          const order = [2, 3].indexOf(i);
          const on = order !== -1 && picked > order;
          return (
            <Chip key={intent} label={intent} selected={on} style={{ minHeight: 52 }}>
              {order !== -1 && <Tap start={start} at={6.0 + order * 0.7} x="70%" />}
            </Chip>
          );
        })}
      </div>
      <Button label="continue" arrow pressed={pressed}>
        <Tap start={start} at={7.45} />
      </Button>
    </div>
  );
}

function Lock({ start }) {
  const locked = useBeats(start, [9.3]) > 0;
  return (
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <Art name="king" size={120} style={{ alignSelf: 'flex-end' }} />
      <Lede label="3 of 4" title="Lock Lowkei with Face ID, your fingerprint or your passcode?">
        <Txt soft>What you write here stays on this phone. A lock keeps it yours even when someone else picks it up.</Txt>
      </Lede>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Button label={locked ? 'locked' : 'lock it'} pressed={locked}>
          <Tap start={start} at={9.3} />
        </Button>
        <Button kind="link" label="not now" />
      </div>
      {locked && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <Txt v="mono" soft>Only you can open it now.</Txt>
        </motion.div>
      )}
    </div>
  );
}
