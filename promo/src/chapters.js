import { Begin } from './screens/Begin';
import { Calm } from './screens/Calm';
import { Care } from './screens/Care';
import { Chart } from './screens/Chart';
import { CheckIn } from './screens/CheckIn';
import { Circle } from './screens/Circle';
import { Mirror } from './screens/Mirror';
import { Today } from './screens/Today';
import { Vent } from './screens/Vent';
import { T_DARK, You } from './screens/You';

/**
 * The ten chapters: what the caption says beside the phone, which tab is lit,
 * and where the camera goes. Every claim here is something the app does
 * (see mobile/src) — keep it that way when editing copy.
 *
 * `poses` are [seconds into the scene, { x, y, scale }] — the phone eases to
 * each in turn. `theme` is [seconds, 'light' | 'dark' | 'void'] steps.
 */
const REST = { x: 0, y: 0, scale: 1.1 };

export const CHAPTERS = {
  begin: {
    name: 'begin',
    art: 'king',
    screen: Begin,
    title: 'Start in a minute.',
    body: 'An email and a six-digit code — no passwords to forget. Say what brings you here, then lock it with your face or fingerprint.',
    points: ['email sign-in', 'for adults, 18+', 'app lock', 'a daily nudge']
  },
  today: {
    name: 'today',
    tab: 'today',
    art: 'masks',
    screen: Today,
    title: 'Your day at a glance.',
    body: 'Each day, a reading made from your own check-ins — with the receipts behind it.',
    points: ['do & don’t', 'last night’s sleep', 'tomorrow’s outlook', 'inner weather'],
    poses: [
      [1.0, { x: -30, y: 60, scale: 1.5 }],
      [4.0, REST]
    ]
  },
  checkin: {
    name: 'check-in',
    tab: 'check-in',
    art: 'doll',
    screen: CheckIn,
    title: 'One word is enough.',
    body: 'Pick a mood, then the word closest to it — saved on that first tap. Add what was around it, and a line if you want.',
    points: ['four moods', '100 feeling words', 'what’s around it', 'a line of note']
  },
  vent: {
    name: 'vent',
    tab: 'check-in',
    art: 'heart',
    screen: Vent,
    title: 'Put it down. Or send it forward.',
    body: 'Vent onto a page no one reads, then keep it or let it go. Or seal a letter to future you — it opens on its day.',
    points: ['private pages', 'let it go', 'letters to future you', '3 months to a year']
  },
  mirror: {
    name: 'mirror',
    tab: 'mirror',
    art: 'eye',
    screen: Mirror,
    theme: [[0, 'void']],
    title: 'Think out loud.',
    body: 'Ask anything. The Mirror answers from what you’ve told it — your check-ins and nights, not the stars. Type, or just speak.',
    points: ['questions by theme', 'shows what it drew from', 'voice in, read aloud', 'crisis goes to people'],
    poses: [
      [5.2, { x: -20, y: 120, scale: 1.45 }],
      [10.8, REST]
    ]
  },
  chart: {
    name: 'chart',
    tab: 'chart',
    art: 'beetle',
    screen: Chart,
    title: 'See the weather of your weeks.',
    body: 'Thirty days as a wheel of weather. The words you reach for, what’s around your days, your nights as a skyline.',
    points: ['week in reflection', 'mind chart', 'wrapped', '7-day experiments'],
    poses: [
      [0.6, { x: -10, y: -120, scale: 1.45 }],
      [4.0, REST]
    ]
  },
  circle: {
    name: 'circle',
    tab: 'circle',
    art: 'kittens',
    screen: Circle,
    title: 'Your people. Just the weather.',
    body: 'Add friends by code. They see your weather and when you’re running low — never your words.',
    points: ['friends by code', 'running low', 'thinking of you', 'no feed, no likes']
  },
  calm: {
    name: 'calm',
    art: 'swan',
    screen: Calm,
    title: 'Calm, one tap from anywhere.',
    body: 'A guided breath, 5-4-3-2-1 grounding and 29 sounds — rain, ocean, a fire, a train at night. It all works offline.',
    points: ['3 breathing patterns', 'grounding', '29 sounds', 'help in the header']
  },
  care: {
    name: 'care',
    art: 'bandage',
    screen: Care,
    title: 'When it’s more than a moment.',
    body: 'If a check-in or a message reads like crisis, Lowkei puts people first: free lines to call or text, and the plan you wrote on a calmer day.',
    points: ['free crisis lines', 'a safety plan', 'low-day mode', 'never left to an AI']
  },
  yours: {
    name: 'yours',
    tab: 'you',
    art: 'cat',
    screen: You,
    theme: [
      [0, 'light'],
      [T_DARK, 'dark']
    ],
    title: 'Yours, and only yours.',
    body: 'What you write stays on your phone. Lock it, export it in one file, erase it in one tap. Light or dark — and every feature is free.',
    points: ['stays on your phone', 'app lock', 'export everything', 'erase in one tap']
  }
};

export const CHAPTER_IDS = Object.keys(CHAPTERS);
export { REST };
