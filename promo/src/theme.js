// The app's own tokens (mobile/src/theme/tokens.ts) — the film is drawn in them.

export const light = {
  paper: '#F6F6F3',
  ink: '#111111',
  inkSoft: '#6A6A66',
  inkFaint: '#B8B8B3',
  band: '#ECECE8',
  tint: '#F7EEF4',
  disc: '#FFFFFF'
};

export const dark = {
  paper: '#0E0E0E',
  ink: '#F2F2EF',
  inkSoft: '#A09F9A',
  inkFaint: '#4A4A47',
  band: '#1A1A1A',
  tint: '#1C1519',
  disc: '#1C1C1B'
};

export const VOID = '#0A0A0A';

export const signal = {
  clear: '#9A5B1E',
  mild: '#6F6A2A',
  overcast: '#3F6576',
  fog: '#6A6258',
  storm: '#6A4A7E'
};

export const signalDark = {
  clear: '#E0A868',
  mild: '#C9C27A',
  overcast: '#8FB6C7',
  fog: '#B3AA9C',
  storm: '#BFA2D3'
};

// The day's weather in the film: overcast — "Go gently today."
export const SIGNAL = signal.overcast;

/** Palette as CSS variables, so a whole screen can change theme in one animation. */
export const vars = p => Object.fromEntries(Object.entries(p).map(([k, v]) => [`--${k}`, v]));

export const fonts = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Inter", system-ui, sans-serif',
  mono: '"DM Mono", ui-monospace, monospace'
};

// 600–900 ms, no bounce (DESIGN.md › Motion).
export const ease = [0.22, 1, 0.36, 1];
export const easeInOut = [0.65, 0, 0.35, 1];
export const enter = { duration: 0.8, ease };
