import { createContext, useContext } from 'react';
import { motion } from 'framer-motion';

import { SIGNAL, ease, fonts } from './theme';

/**
 * Lowkei's components (mobile/src/components), redrawn for the web at the
 * app's own sizes: a 390-pt-wide phone, 20 pt margins, three typefaces.
 * Colours come from CSS variables set on the screen, so a screen can turn
 * dark in one animation.
 */

const art = import.meta.glob('../../mobile/assets/art/*.png', { eager: true, query: '?url', import: 'default' });
export const artUrl = name => art[`../../mobile/assets/art/${name}.png`];
export const ART_NAMES = Object.keys(art).map(k => k.split('/').pop().replace('.png', ''));

/** Inside a dark screen, silhouettes switch to their light-ink versions. */
export const DarkArt = createContext(false);

const c = name => `var(--${name})`;

export const T = {
  reading: { fontFamily: fonts.serif, fontSize: 40, lineHeight: '44px', letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: '34px', letterSpacing: -0.2 },
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: '27px' },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: '23px' },
  bodyItalic: { fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 20, lineHeight: '26px' },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: '19px' },
  receipt: { fontFamily: fonts.mono, fontSize: 13, lineHeight: '21px' },
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: '17px' },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: '16px', letterSpacing: 1.3, textTransform: 'uppercase' },
  action: { fontFamily: fonts.mono, fontWeight: 500, fontSize: 12, lineHeight: '17px', letterSpacing: 1.3, textTransform: 'uppercase' }
};

export function Txt({ v = 'body', soft, style, children, ...rest }) {
  return (
    <motion.div style={{ ...T[v], color: soft ? c('inkSoft') : c('ink'), ...style }} {...rest}>
      {children}
    </motion.div>
  );
}

export function Art({ name, size = 80, style }) {
  const dark = useContext(DarkArt);
  const darkName = `${name}-dark`;
  const src = dark && artUrl(darkName) ? artUrl(darkName) : artUrl(name);
  return <img src={src} alt="" style={{ height: size, width: 'auto', display: 'block', ...style }} />;
}

/** The round plate an illustration sits in. */
export function ArtDisc({ name, size = 104, style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: c('disc'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <Art name={name} size={size * 0.62} />
    </div>
  );
}

export const Dot = ({ size = 6, color = SIGNAL, style }) => (
  <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flex: 'none', ...style }} />
);

/** Header on every tab: wordmark + weather dot, CALM on the right. */
export function AppHeader({ right = 'calm', left = true, extra }) {
  return (
    <div style={{ height: 52, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: left ? 1 : 0 }}>
        <Txt v="label" style={{ letterSpacing: 2.4, fontWeight: 500 }}>Lowkei</Txt>
        <Dot />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {extra}
        <Txt v="label">{right}</Txt>
      </div>
    </div>
  );
}

/** Sub-screen header: back arrow, mono title centred. */
export function SubHeader({ title, right }) {
  return (
    <div style={{ height: 52, padding: '0 20px', display: 'flex', alignItems: 'center', flex: 'none' }}>
      <div style={{ width: 44 }}>
        <Arrow dir="left" size={16} />
      </div>
      <Txt v="label" style={{ flex: 1, textAlign: 'center' }}>{title}</Txt>
      <div style={{ width: 44, textAlign: 'right' }}>{right && <Txt v="label">{right}</Txt>}</div>
    </div>
  );
}

export const TABS = ['today', 'check-in', 'circle', 'mirror', 'chart', 'you'];

/** Text-only tab bar; the active tab is ink with a small signal dot. */
export function TabBar({ active }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px 30px', flex: 'none' }}>
      {TABS.map(tab => (
        <div key={tab} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minHeight: 32 }}>
          <motion.div
            animate={{ color: tab === active ? 'var(--ink)' : 'var(--inkSoft)' }}
            transition={{ duration: 0.6, ease }}
            style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' }}
          >
            {tab}
          </motion.div>
          {tab === active && <motion.div layoutId="tab-dot" transition={{ duration: 0.7, ease }} style={{ width: 4, height: 4, borderRadius: 4, background: SIGNAL }} />}
        </div>
      ))}
    </div>
  );
}

export function Arrow({ dir = 'right', size = 12, color = 'var(--ink)' }) {
  const rot = { right: 0, left: 180, down: 90, up: -90 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ transform: `rotate(${rot}deg)`, display: 'block' }}>
      <path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

/** Mono label, big serif line, short paragraph. */
export function Lede({ label, title, big, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {label && <Txt v="label" soft>{label}</Txt>}
      <Txt v={big ? 'reading' : 'title'}>{title}</Txt>
      {children}
    </div>
  );
}

/** Mono uppercase label with a hairline under it. */
export function SectionLabel({ children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 8 }}>
      <Txt v="label">{children}</Txt>
    </div>
  );
}

export function Section({ title, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

export function Row({ title, subtitle, arrow = true, leading, style, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 60, padding: '14px 0', borderBottom: '0.5px solid var(--ink)', position: 'relative', ...style }}>
      {leading && <div style={{ width: 36, display: 'flex', justifyContent: 'center' }}>{leading}</div>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Txt v="heading">{title}</Txt>
        {subtitle && <Txt v="caption" soft>{subtitle}</Txt>}
      </div>
      {arrow && <Arrow />}
      {children}
    </div>
  );
}

export function DoDont({ dos, donts }) {
  const col = (head, items) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Txt v="mono" soft style={{ marginBottom: 4 }}>{head}</Txt>
      {items.map(i => (
        <Txt key={i} v="heading">{i}</Txt>
      ))}
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {col('Do', dos)}
      {col('Don’t', donts)}
    </div>
  );
}

/** Solid ink rectangle (primary), outlined (outline) or underlined (link). */
export function Button({ label, kind = 'primary', arrow, style, pressed, children }) {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', position: 'relative', ...T.action };
  if (kind === 'link')
    return (
      <div style={{ ...base, color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3, padding: '4px 0', ...style }}>
        {label}
        {children}
      </div>
    );
  const primary = kind === 'primary';
  return (
    <motion.div
      animate={{ scale: pressed ? 0.97 : 1, opacity: pressed ? 0.75 : 1 }}
      transition={{ duration: 0.25, ease }}
      style={{
        ...base,
        padding: '16px 28px',
        minHeight: 48,
        background: primary ? 'var(--ink)' : 'transparent',
        color: primary ? 'var(--paper)' : 'var(--ink)',
        border: primary ? 'none' : '1px solid var(--ink)',
        ...style
      }}
    >
      {label}
      {arrow && <Arrow color={primary ? 'var(--paper)' : 'var(--ink)'} />}
      {children}
    </motion.div>
  );
}

/** Square bordered box with a serif word; inverted when selected. */
export function Chip({ label, selected, style, children }) {
  return (
    <motion.div
      animate={{ backgroundColor: selected ? 'var(--ink)' : 'rgba(0,0,0,0)', color: selected ? 'var(--paper)' : 'var(--ink)' }}
      transition={{ duration: 0.35, ease }}
      style={{
        minHeight: 44,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--ink)',
        fontFamily: fonts.serif,
        fontSize: 19,
        position: 'relative',
        ...style
      }}
    >
      {label}
      {children}
    </motion.div>
  );
}

/** Horizontal mono tabs with ○ bullets (● active) and an underline. */
export function Segmented({ options, value }) {
  return (
    <div style={{ display: 'flex', gap: 24, borderBottom: '0.5px solid var(--ink)', margin: '0 -20px', padding: '0 20px' }}>
      {options.map(o => {
        const on = o === value;
        return (
          <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, position: 'relative' }}>
            <motion.span
              animate={{ backgroundColor: on ? 'var(--ink)' : 'rgba(0,0,0,0)' }}
              transition={{ duration: 0.4, ease }}
              style={{ width: 7, height: 7, borderRadius: 7, border: '1px solid var(--ink)' }}
            />
            <motion.span animate={{ color: on ? 'var(--ink)' : 'var(--inkSoft)' }} style={{ ...T.label }}>
              {o}
            </motion.span>
            {on && <motion.div layoutId="seg-line" transition={{ duration: 0.6, ease }} style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 1.5, background: 'var(--ink)' }} />}
          </div>
        );
      })}
    </div>
  );
}

/** Settings line with a switch: grey when off, ink when on. */
export function Toggle({ on }) {
  return (
    <motion.div
      animate={{ backgroundColor: on ? 'var(--ink)' : 'var(--inkFaint)' }}
      transition={{ duration: 0.4, ease }}
      style={{ width: 40, height: 22, borderRadius: 11, padding: 2, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', flex: 'none' }}
    >
      <motion.div layout transition={{ duration: 0.4, ease }} style={{ width: 18, height: 18, borderRadius: 9, background: 'var(--paper)' }} />
    </motion.div>
  );
}

export function SettingRow({ title, subtitle, on, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 52, padding: '10px 0', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Txt v="body" style={{ fontSize: 16 }}>{title}</Txt>
        {subtitle && <Txt v="caption" soft>{subtitle}</Txt>}
      </div>
      {on !== undefined && <Toggle on={on} />}
      {children}
    </div>
  );
}

/** Bordered box, optional mono header row divided by a rule. */
export function Box({ title, children, centred, style }) {
  return (
    <div style={{ border: '1px solid var(--ink)', ...style }}>
      {title && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink)' }}>
          <Txt v="label">{title}</Txt>
        </div>
      )}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, alignItems: centred ? 'center' : 'stretch' }}>{children}</div>
    </div>
  );
}

/** The weather's one colour, with a slow ring breathing out from it. */
export function WeatherMark({ color = SIGNAL, size = 14 }) {
  return (
    <div style={{ width: size * 2.6, height: size * 2.6, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        initial={{ scale: 1, opacity: 0.45 }}
        animate={{ scale: 2.4, opacity: 0 }}
        transition={{ duration: 3.2, ease: [0.5, 1, 0.89, 1], repeat: Infinity }}
        style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', border: `1.5px solid ${color}` }}
      />
      <div style={{ width: size, height: size, borderRadius: '50%', background: color }} />
    </div>
  );
}

/** A writing sheet: a soft tinted block with its prompt in italic serif. */
export function Sheet({ prompt, children, style }) {
  return (
    <div style={{ background: 'var(--tint)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {prompt && <Txt v="bodyItalic">{prompt}</Txt>}
      {children}
    </div>
  );
}

/** A blinking caret for typed text. */
export function Caret({ color = 'var(--ink)' }) {
  return (
    <motion.span
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
      style={{ display: 'inline-block', width: 1.5, height: '1.05em', background: color, verticalAlign: '-0.15em', marginLeft: 1 }}
    />
  );
}

/** The bottom of a feed: an ink mound with "The end" and a link. */
export function EndMark({ link }) {
  return (
    <div style={{ position: 'relative', margin: '0 -20px', paddingTop: 30 }}>
      <svg viewBox="0 0 390 40" width="390" height="40" style={{ display: 'block' }}>
        <motion.path
          animate={{
            d: [
              'M0 40 L0 22 C60 10 120 18 195 12 C270 6 330 16 390 20 L390 40 Z',
              'M0 40 L0 18 C70 14 120 8 195 14 C260 20 330 10 390 16 L390 40 Z',
              'M0 40 L0 22 C60 10 120 18 195 12 C270 6 330 16 390 20 L390 40 Z'
            ]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          fill="var(--ink)"
        />
        <circle cx="120" cy="2" r="2.5" fill="var(--ink)" />
        <circle cx="262" cy="6" r="1.8" fill="var(--ink)" />
      </svg>
      <div style={{ background: 'var(--ink)', padding: '20px 20px 44px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div style={{ ...T.title, color: 'var(--paper)', fontStyle: 'italic' }}>The end</div>
        <div style={{ ...T.action, color: 'var(--paper)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{link}</div>
      </div>
    </div>
  );
}
