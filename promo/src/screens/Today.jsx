import { motion } from 'framer-motion';

import { Scroll } from '../Phone';
import { SIGNAL, ease } from '../theme';
import { AppHeader, Arrow, Art, ArtDisc, Button, DoDont, EndMark, Lede, Row, Section, Txt, WeatherMark } from '../ui';

export const TODAY_SCROLL = [
  [0, 0],
  [4.6, 0],
  [6.6, 560],
  [8.6, 560],
  [10.4, 1130],
  [12.6, 1380]
];

/** Today — the day at a glance, then everything the reading was built from. */
export function Today({ start }) {
  return (
    <>
      <AppHeader
        extra={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Txt v="label">today</Txt>
            <Arrow dir="down" size={11} />
          </span>
        }
      />
      <Scroll start={start} stops={TODAY_SCROLL} style={{ gap: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <motion.div animate={{ y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] }} transition={{ duration: 8.4, repeat: Infinity, ease: 'easeInOut' }}>
            <ArtDisc name="orchid" size={104} />
          </motion.div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Lede label="your day at a glance · 13 Oct" title="Go gently today." big>
            <Txt>You’ve slept under six hours on three of the last five nights. The days after ran heavier.</Txt>
          </Lede>
          <DoDont dos={['An early night', 'A friend’s voice', 'Something warm']} donts={['Comparisons', 'Skipping meals', 'The news, twice']} />
          <Button kind="link" label="share today’s reading" />
          <Button label="check in" arrow />
        </div>

        <Section title="tomorrow">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
            <Txt v="heading">Tomorrow may run lighter.</Txt>
            <Txt soft>Tuesdays usually do, and you’re due a longer night.</Txt>
          </div>
          <Row title="Tuesdays run lighter" subtitle="6 of your last 8" arrow={false} />
          <Txt v="caption" soft>An outlook from your own patterns, like weather — not a prediction about you.</Txt>
        </Section>

        <Section title="by area">
          {[
            ['sleep', 1, 'running short'],
            ['energy', 2, 'low, steadying'],
            ['mood', 3, 'mixed'],
            ['people', 4, 'a lift lately']
          ].map(([area, level, note]) => (
            <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
              <Txt v="label" style={{ width: 64 }}>{area}</Txt>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} style={{ width: 14, height: 6, background: i < level ? 'var(--ink)' : 'var(--band)' }} />
                ))}
              </div>
              <Txt v="caption" soft>{note}</Txt>
            </div>
          ))}
        </Section>

        <Section title="last night">
          <Row title="6h 10m" subtitle="00:40 – 06:50" />
        </Section>

        <Section title="behind this reading">
          <Row title="Three short nights in five" subtitle="under six hours, from your own log" arrow={false} />
          <Row title="“Drained”, four times" subtitle="this week’s check-ins" arrow={false} />
          <Row title="Work, around most heavy days" subtitle="tagged on 5 of 7" arrow={false} />
        </Section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Art name="masks" size={110} />
          <div style={{ flex: 1, height: 0.5, background: 'var(--inkSoft)' }} />
        </div>

        <Section title="inner weather">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
            <WeatherMark color={SIGNAL} />
            <Txt v="title">Overcast</Txt>
          </div>
          <Txt v="caption" soft>From your check-ins over the last three days. It sets the one colour you see around the app.</Txt>
        </Section>

        <EndMark link="write something down" />
      </Scroll>
    </>
  );
}

export const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease } };
