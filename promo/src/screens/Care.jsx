import { Scroll } from '../Phone';
import { useBeats } from '../timeline';
import { AppHeader, Art, Button, Lede, Row, Section, SubHeader, Txt } from '../ui';
import { Swap } from './Swap';

const LINES = [
  ['988 Suicide & Crisis Lifeline', 'call or text 988 · US'],
  ['Tele-MANAS', 'call 14416 · India'],
  ['Samaritans', 'call 116 123 · UK & Ireland']
];

/** When a check-in or message reads as crisis: people first. Then low-day mode. */
export function Care({ start }) {
  const page = useBeats(start, [5.8]);
  return (
    <Swap k={page}>
      {page === 0 ? <Crisis start={start} /> : <LowDay />}
    </Swap>
  );
}

function Crisis({ start }) {
  return (
    <>
      <SubHeader title="a moment" />
      <Scroll start={start} stops={[[2.2, 0], [3.6, 250]]} style={{ gap: 28 }}>
        <Art name="bandage" size={60} style={{ alignSelf: 'flex-end' }} />
        <Lede title="That sounds like a lot to carry." big>
          <Txt>What you wrote is saved, and it stays on this phone. Before anything else:</Txt>
        </Lede>
        <Button label="breathe for a minute" arrow />
        <Section title="free, confidential, open now">
          {LINES.map(([name, how]) => (
            <Row key={name} title={name} subtitle={how}>
              <Txt v="action" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>call</Txt>
            </Row>
          ))}
        </Section>
        <Button kind="link" label="your safety plan" />
        <Button kind="link" label="i’m okay for now" />
      </Scroll>
    </>
  );
}

function LowDay() {
  return (
    <>
      <AppHeader />
      <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <Art name="swallow" size={110} style={{ alignSelf: 'flex-end' }} />
        <Lede label="today, gently" title="Just this, for now." big>
          <Txt>The last few days have been heavy. Today doesn’t need anything from you.</Txt>
        </Lede>
        <Section title="one small thing">
          <Row title="Breathe for a minute" subtitle="calm · double sigh" />
          <Row title="Your safety plan" subtitle="seven short steps, written on a calmer day" />
        </Section>
        <div style={{ display: 'flex', gap: 24 }}>
          <Button kind="link" label="need help now" />
          <Button kind="link" label="show the whole day" />
        </div>
      </div>
    </>
  );
}
