import { motion } from 'framer-motion';

import { Scroll } from '../Phone';
import { Tap } from '../Tap';
import { useBeats } from '../timeline';
import { ease } from '../theme';
import { AppHeader, Art, Chip, Lede, Row, SettingRow, Txt } from '../ui';

export const T_DARK = 3.0;
const T_LOCK = 5.6;
const T_EXPORT = 9.4;

function Group({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Txt v="mono" soft>{title}</Txt>
      <div>{children}</div>
    </div>
  );
}

/** You: how it looks, the reminder, the lock, what may be used, your data. */
export function You({ start }) {
  const dark = useBeats(start, [T_DARK]) > 0;
  const locked = useBeats(start, [T_LOCK]) > 0;
  const exported = useBeats(start, [T_EXPORT + 0.3]) > 0;
  return (
    <>
      <AppHeader />
      <Scroll start={start} stops={[[6.6, 0], [8.2, 470]]} style={{ gap: 36 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Lede label="day 41" title="Your space." big />
          <Art name="cat" size={80} />
        </div>
        <Group title="Appearance">
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            {['light', 'dark', 'phone'].map(o => (
              <Chip key={o} label={o} selected={dark ? o === 'dark' : o === 'light'} style={{ flex: 1, justifyContent: 'center' }}>
                {o === 'dark' && <Tap start={start} at={T_DARK} />}
              </Chip>
            ))}
          </div>
        </Group>
        <Group title="Notifications">
          <SettingRow title="Daily reminder" subtitle="21:00, a gentle nudge" on />
          <SettingRow title="Letters, reflections and circle" subtitle="When a letter is ready, or someone reaches out" on />
        </Group>
        <Group title="Privacy">
          <SettingRow title="App lock" subtitle="Face, fingerprint or passcode to open" on={locked}>
            <div style={{ position: 'absolute', right: 20, top: '50%', width: 0, height: 0 }}>
              <Tap start={start} at={T_LOCK} />
            </div>
          </SettingRow>
          <SettingRow title="Readings from your numbers" subtitle="Counts and averages only — never your words" on />
          <SettingRow title="AI reflections" subtitle="Send a vent page or a Mirror message to an AI, to reflect it back" on={false} />
        </Group>
        <Group title="Your data">
          <Row title="Export" subtitle="Check-ins, pages, nights, Mirror, your plan and your account — one file">
            <Tap start={start} at={T_EXPORT} />
          </Row>
          {exported && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.6, ease }}>
              <Txt v="mono" soft style={{ padding: '8px 0' }}>lowkei-export.json · saved to your phone</Txt>
            </motion.div>
          )}
          <Row title="Privacy policy" subtitle="What stays on this phone, and what doesn’t" />
          <Row title="Erase" subtitle="Everything, in one tap — and it’s gone" />
        </Group>
      </Scroll>
    </>
  );
}

