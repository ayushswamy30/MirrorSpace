import { Calm } from './screens/Calm';
import { Care } from './screens/Care';
import { Chart } from './screens/Chart';
import { CheckIn } from './screens/CheckIn';
import { Circle } from './screens/Circle';
import { Mirror } from './screens/Mirror';
import { Today } from './screens/Today';
import { Vent } from './screens/Vent';
import { You } from './screens/You';

/**
 * The vertical cut. Each scene plays one of the app's screens at `pace`
 * (screen seconds per film second), joining it at `from` (screen seconds) —
 * the same screens as the 16:9 film, just quicker. Captions are one line
 * and a small mono note; every claim is something the app does.
 *
 * `poses` are [film seconds into the scene, pose]; the phone eases to each.
 * `theme` steps are in screen seconds.
 */
export const REST = { x: 0, y: 0, scale: 1.62, rotate: 0, rotateX: 0, rotateY: 0 };
const swing = dir => ({ ...REST, rotateY: 11 * dir, x: 24 * dir, scale: 1.58 });
// Pushes keep the phone's top below the caption: y ≥ 433·scale + 480 − 1180.
const push = (y, scale = 1.82) => ({ ...REST, y, scale });

export const REEL = {
  hook: {
    poses: [
      [0, { ...REST, y: 1500, rotateX: 30, scale: 1.3 }],
      [2.35, { ...REST, y: 40, rotateX: 8 }]
    ]
  },
  checkin: {
    screen: CheckIn,
    pace: 2,
    tab: 'check-in',
    kicker: 'check in',
    title: 'One word is enough.',
    sub: '4 moods · 100 words · saved on the first tap',
    overlay: 'ghost',
    poses: [
      [0, REST],
      [3.0, push(90)],
      [6.0, REST]
    ]
  },
  today: {
    screen: Today,
    pace: 1.6,
    tab: 'today',
    kicker: 'today',
    title: 'Your day, read back to you.',
    sub: 'from your own check-ins · sleep · tomorrow',
    poses: [
      [0, swing(1)],
      [0.55, push(95)],
      [2.6, REST]
    ]
  },
  vent: {
    screen: Vent,
    pace: 1.35,
    from: 0.7,
    tab: 'check-in',
    kicker: 'vent',
    title: 'Say it. Then let it go.',
    sub: 'no one reads this — keep it, or let it go',
    overlay: 'scatter',
    poses: [
      [0, swing(-1)],
      [0.55, REST]
    ]
  },
  letters: {
    screen: Vent,
    pace: 1.6,
    from: 7.6,
    tab: 'check-in',
    kicker: 'letters',
    title: 'Write to future you.',
    sub: 'sealed for 3 months, 6, or a year',
    poses: [
      [0, swing(1)],
      [0.55, REST]
    ]
  },
  mirror: {
    screen: Mirror,
    pace: 1.5,
    tab: 'mirror',
    theme: [[0, 'void']],
    kicker: 'mirror',
    title: 'Think out loud.',
    sub: 'it answers from your days — not the stars',
    overlay: 'void',
    poses: [
      [0, swing(-1)],
      [0.7, REST],
      [3.3, push(95)],
      [6.9, REST]
    ]
  },
  chart: {
    screen: Chart,
    pace: 1.8,
    tab: 'chart',
    kicker: 'chart',
    title: 'Your weeks, as weather.',
    sub: '30 days · the words you use · your nights',
    poses: [
      [0, swing(1)],
      [0.5, push(160)],
      [2.3, REST]
    ]
  },
  circle: {
    screen: Circle,
    pace: 1.4,
    from: 3.2,
    tab: 'circle',
    kicker: 'circle',
    title: 'Your people. Just the weather.',
    sub: 'they see how you are — never what you wrote',
    poses: [
      [0, swing(-1)],
      [0.6, REST]
    ]
  },
  calm: {
    screen: Calm,
    pace: 1.6,
    kicker: 'calm',
    title: 'Breathe out longer than in.',
    sub: 'breathing · grounding · 29 sounds · offline',
    overlay: 'rings',
    poses: [
      [0, swing(1)],
      [0.6, REST]
    ]
  },
  crisis: {
    screen: Care,
    from: 0.8,
    kicker: 'care',
    title: 'Help, one tap away.',
    sub: 'free crisis lines · your safety plan',
    poses: [
      [0, swing(-1)],
      [0.45, REST]
    ]
  },
  lowday: {
    screen: Care,
    from: 6.6,
    tab: 'today',
    kicker: 'care',
    title: 'Low days, gently.',
    sub: 'today asks nothing of you',
    poses: [
      [0, swing(1)],
      [0.45, REST]
    ]
  },
  dark: {
    screen: You,
    from: 2.55,
    tab: 'you',
    theme: [
      [0, 'light'],
      [3.0, 'dark']
    ],
    kicker: 'yours',
    title: 'Light, or dark.',
    sub: 'your space, your way',
    poses: [
      [0, swing(-1)],
      [0.45, REST]
    ]
  },
  data: {
    screen: You,
    from: 8.2,
    pace: 1.2,
    tab: 'you',
    theme: [[0, 'dark']],
    kicker: 'yours',
    title: 'Lock it. Export it. Erase it.',
    sub: 'what you write stays on your phone',
    poses: [
      [0, swing(1)],
      [0.45, REST]
    ]
  },
  outro: {
    poses: [[0, { ...REST, y: 600, scale: 1.2, rotateX: 10 }]]
  }
};

/** The Stories-style bar: one segment per feature, the quick run at the end as one. */
export const SEGMENTS = [
  ['checkin'],
  ['today'],
  ['vent'],
  ['letters'],
  ['mirror'],
  ['chart'],
  ['circle'],
  ['calm'],
  ['crisis', 'lowday', 'dark', 'data']
];
