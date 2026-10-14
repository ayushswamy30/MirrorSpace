import type { CheckIn } from './checkIns';
import { nightsSignal, trendSignal, weekdaySignal } from './forecast';
import { formatDuration, type SleepLog } from './sleep';
import type { Weather } from '@/theme/tokens';

/**
 * The day's reading, written for one person on one day. Everything it reads
 * stays on the phone: check-ins (the words, the tags), last night, the pages
 * kept, and the patterns found in them. Nothing is generated anywhere else.
 *
 * Two things keep it from reading the same for everyone, every day:
 * - what it is about: the most telling thing in the person's own recent days
 *   (a short night, a word from yesterday, a tag that keeps coming up, what
 *   they've been writing about, a heavier run, a weekday that tends to drag),
 *   picked with weights so one strong signal leads but others get their turn;
 * - how it is said: headlines, lines and Do/Don't lists rotate through larger
 *   pools, offset by the person's id, so tomorrow never repeats today and two
 *   people with the same week still read differently.
 *
 * The same day always gives the same reading (it is seeded by the date), so
 * an old day never quietly changes and the 11:11 note matches the page.
 *
 * Each reading also carries `note`: a line for the lock screen. Notes may say
 * what the day is about ("a short night", "work"), never a feeling word the
 * person chose or anything they wrote.
 */

export type Reading = {
  headline: string;
  subtext: string;
  dos: readonly string[];
  donts: readonly string[];
  /** One line for the 11:11 notification — safe for a lock screen. */
  note?: string;
};

/** Just what the reading needs from a vent page. */
export type PageLike = { createdAt: string; body: string };

type Fact = { key: string; text: string; weight: number };

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Seeded choices

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A repeatable stream of numbers in [0, 1) for one seed. */
function stream(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Days since 1970 for a YYYY-MM-DD, so consecutive days are consecutive numbers. */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * The pool's item for this day: walks the pool one step a day from a point
 * set by the person, so two days in a row never share it.
 */
function rotate<T>(pool: readonly T[], seed: string, date: string): T {
  return pool[(hash(seed) + dayNumber(date)) % pool.length];
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weighted<T extends { weight: number }>(items: readonly T[], next: () => number): T | undefined {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let at = next() * total;
  for (const item of items) {
    at -= item.weight;
    if (at < 0) return item;
  }
  return items[items.length - 1];
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// The words

type Voice = {
  headlines: readonly string[];
  lines: readonly string[];
  notes: readonly string[];
  dos: readonly string[];
  donts: readonly string[];
};

const BY_WEATHER: Record<Weather, Voice> = {
  clear: {
    headlines: [
      'Let it be easy.',
      'Follow what’s working.',
      'Say yes to the light stuff.',
      'Enjoy it without explaining it.',
      'Leave room for the good to land.',
      'Spend it on something you love.',
      'Keep a little for later.'
    ],
    lines: [
      'Things have been light lately. Notice what’s helping, so you can find it again.',
      'A good stretch. You don’t have to earn it or justify it — just let it be.',
      'There’s some ease in your days right now. Use a bit of it on something that matters to you.',
      'Lighter days are worth studying too. What’s different about them?'
    ],
    notes: [
      'Things have been lighter lately. Notice what’s helping.',
      'A good stretch. Spend a little of it on something you love.',
      'Some ease in the days lately. Let it be easy today.'
    ],
    dos: ['Saying yes', 'Daylight', 'Starting something', 'Calling someone back', 'A long lunch', 'Making plans', 'Music, loud', 'A new route home'],
    donts: ['Overbooking', 'Skipping rest', 'Dimming it', 'Waiting for the catch', 'Explaining yourself', 'Late nights, again']
  },
  mild: {
    headlines: [
      'Keep the pace you’ve found.',
      'Steady is enough.',
      'Tend the small routines.',
      'Nothing needs fixing today.',
      'An ordinary day, done well.',
      'Keep it simple and keep going.',
      'Do the usual, on purpose.'
    ],
    lines: [
      'Steady is its own kind of good. Nothing needs fixing today.',
      'Not high, not low — a good place to do the small things that keep you well.',
      'An even stretch. A good day to tidy one corner of your life, and stop there.',
      'Middling days are the ones routines are made for. Lean on yours.'
    ],
    notes: [
      'An even stretch lately. Keep the pace you’ve found.',
      'Steady is enough today. Do the usual, on purpose.',
      'Nothing needs fixing today. One small routine, done well.'
    ],
    dos: ['Routine', 'A long walk', 'One tidy corner', 'A proper meal', 'Finishing one thing', 'An early start', 'Fresh air', 'A tidy desk'],
    donts: ['Overplanning', 'Screens in bed', 'Rushing', 'Starting five things', 'Skipping lunch', 'Doomscrolling']
  },
  overcast: {
    headlines: [
      'Go gently today.',
      'Ask a little less of today.',
      'Soft focus is fine.',
      'Do the next kind thing.',
      'Half speed still gets there.',
      'Let the day be small.',
      'Be on your own side.'
    ],
    lines: [
      'Not bad, not bright. The kind of day that goes better with less asked of it.',
      'A grey stretch. Keep the plan short and the standards kind.',
      'Some weight in the air lately. Pick one thing that matters and let the rest wait.',
      'Muted days are still days. Small comforts count double right now.'
    ],
    notes: [
      'A grey stretch lately. Ask a little less of today.',
      'Go gently today. Small comforts count double.',
      'Keep the plan short and the standards kind today.'
    ],
    dos: ['An early night', 'A friend’s voice', 'Something warm', 'A short walk', 'A shower, slowly', 'One thing at a time', 'Familiar music', 'Clean sheets'],
    donts: ['Comparisons', 'Skipping meals', 'The news, twice', 'Overcommitting', 'Rereading old messages', 'Harsh self-talk']
  },
  fog: {
    headlines: [
      'Small steps count.',
      'Just the next thing.',
      'You don’t have to see far.',
      'Water, light, one task.',
      'Be slow on purpose.',
      'Lower the bar. Then step over it.',
      'Enough is enough today.'
    ],
    lines: [
      'Low and heavy lately. You don’t have to see far ahead — just the next small thing.',
      'Running on little right now. The basics are the whole job today: water, food, light.',
      'A foggy stretch. Make the day smaller until it fits.',
      'When everything feels far away, close is good. One task, one person, one walk.'
    ],
    notes: [
      'Low on energy lately. Just the next small thing today.',
      'Water, light, one task. That’s a full day right now.',
      'A foggy stretch. Make today small enough to fit.'
    ],
    dos: ['Water', 'Ten minutes outside', 'One small task', 'Opening a window', 'Eating something real', 'A message to one person', 'Sunlight early', 'Stretching'],
    donts: ['Big decisions', 'Endless scrolling', 'Late nights', 'A long to-do list', 'Staying in bed all day', 'Judging the pace']
  },
  storm: {
    headlines: [
      'Put something down first.',
      'Let it settle before you act.',
      'Breathe out longer than in.',
      'Not everything needs an answer today.',
      'Move the feeling, not the furniture.',
      'Wait before you send it.',
      'Cool the engine.'
    ],
    lines: [
      'A lot of charge, not much ease. Let it settle before you act on it.',
      'Wound up lately. Your body might need moving before your mind will slow down.',
      'High pressure, low comfort. Decide nothing big until it passes — it will.',
      'Lots of noise inside right now. Write it down before you say it out loud.'
    ],
    notes: [
      'A lot of charge lately. Let it settle before you act on it.',
      'Breathe out longer than in. Then decide.',
      'Not everything needs an answer today.'
    ],
    dos: ['Slow breaths out', 'Moving your body', 'Writing it down', 'Cold water on your face', 'A walk, fast', 'Sleeping on it', 'Turning notifications off', 'Being alone for a bit'],
    donts: ['Sending that message', 'More caffeine', 'Arguing at night', 'Deciding in a rush', 'Replaying it', 'Checking their profile']
  }
};

const GENERAL: Voice = {
  headlines: [
    'Notice one thing today.',
    'Start with how you are.',
    'Pay attention to the small stuff.',
    'One honest word is enough.',
    'See what today is made of.',
    'Check the weather inside.',
    'Be curious about your day.'
  ],
  lines: [
    'How you slept, what you ate, who you talked to. Noticing is where patterns start.',
    'You don’t need a reason to check in. A word a day, and your days start to make sense.',
    'The small things — sleep, light, people — tend to matter more than they look. Watch one today.',
    'Before the day decides for you, take a second to ask how you are.'
  ],
  notes: [
    'A minute for yourself? One word for how you are is enough.',
    'Before the day decides for you: how are you, really?',
    'Notice one thing today — sleep, food, people, light.',
    'Check the weather inside. One word will do.'
  ],
  dos: ['Checking in', 'Daylight', 'A slow breath', 'A glass of water', 'Stepping outside', 'Naming the feeling'],
  donts: ['Rushing past it', 'Judging it', 'Keeping score', 'Skipping breakfast', 'Screens first thing']
};

/** For when readings are off: the shape of the general reading. */
export const GENERAL_READING: Reading = {
  headline: GENERAL.headlines[0],
  subtext: GENERAL.lines[0],
  dos: GENERAL.dos.slice(0, 3),
  donts: GENERAL.donts.slice(0, 3),
  note: GENERAL.notes[0]
};

/** What each context tag tends to need. The note is for a lock screen. */
const TAGS: Record<string, { heavier: string; lighter: string; note: string; noteLighter: string; dos: string[]; donts: string[] }> = {
  work: {
    heavier: 'Give it its hours today, and not one more.',
    lighter: 'Something about it is working — notice what.',
    note: 'Work has been taking up a lot of room. Give it its hours, not one more.',
    noteLighter: 'Work has been going better lately. Notice what’s different.',
    dos: ['A real lunch break', 'One task, finished'],
    donts: ['Answering after hours', 'Working through lunch']
  },
  study: {
    heavier: 'Short sessions with real breaks beat one long grind.',
    lighter: 'You’re finding a rhythm with it. Protect it.',
    note: 'Study has been heavy lately. Short sessions, real breaks.',
    noteLighter: 'You’re finding a rhythm with studying. Protect it today.',
    dos: ['Forty minutes, then a break', 'Studying with someone'],
    donts: ['All-nighters', 'Studying in bed']
  },
  money: {
    heavier: 'Look at one number today, not all of them.',
    lighter: 'A little less pressure there lately. Good.',
    note: 'Money has been on your mind. Look at one number today, not all of them.',
    noteLighter: 'A little less money pressure lately. Good.',
    dos: ['One small sum, sorted'],
    donts: ['Checking the balance again', 'Comparing']
  },
  family: {
    heavier: 'You can love people and still need a bit of distance from them.',
    lighter: 'Family has been good for you lately. Lean in a little.',
    note: 'Family has been a big part of the week. Some distance is allowed too.',
    noteLighter: 'Family has been good for you lately. Lean in a little today.',
    dos: ['A boundary, kindly said'],
    donts: ['Old arguments']
  },
  partner: {
    heavier: 'Say the true thing gently, or say it tomorrow.',
    lighter: 'Time with them has been helping. Make some on purpose.',
    note: 'Someone close has been on your mind. Gentle words, or tomorrow’s.',
    noteLighter: 'Time with someone close has been helping. Make some on purpose.',
    dos: ['Saying what you need'],
    donts: ['Late-night arguments', 'Guessing what they meant']
  },
  friends: {
    heavier: 'Not every friendship needs fixing today. Some just need space.',
    lighter: 'Your people have been good for you. Reach for one of them.',
    note: 'Friendships have been weighing on you. Some just need space today.',
    noteLighter: 'Your people have been good for you. Reach for one of them today.',
    dos: ['Texting a friend first'],
    donts: ['Reading into the silence']
  },
  alone: {
    heavier: 'Time alone has run heavy. One small bit of company could change the shape of the day.',
    lighter: 'Time on your own has been good for you. Keep a little of it.',
    note: 'A lot of time on your own lately. One small bit of company today?',
    noteLighter: 'Time on your own has been good for you. Keep a little today.',
    dos: ['A café instead of home', 'One message to someone'],
    donts: ['Disappearing for days']
  },
  sleep: {
    heavier: 'Tonight matters more than today. Protect the hour before bed.',
    lighter: 'Rest has been doing its work. Keep the routine.',
    note: 'Sleep keeps coming up. Protect the hour before bed tonight.',
    noteLighter: 'Rest has been doing its work. Keep the routine tonight.',
    dos: ['A wind-down hour'],
    donts: ['Screens in bed', 'Caffeine after 2']
  },
  movement: {
    heavier: 'Gentle counts. A walk is movement too.',
    lighter: 'Moving has been lifting you. Do it again today.',
    note: 'Gentle counts today. A walk is movement too.',
    noteLighter: 'Moving has been lifting you. Do it again today.',
    dos: ['A walk, any length'],
    donts: ['Skipping it entirely']
  },
  food: {
    heavier: 'Eat something real, at a real time.',
    lighter: 'Good meals have been part of good days.',
    note: 'Eat something real, at a real time today.',
    noteLighter: 'Good meals have been part of good days. Have one today.',
    dos: ['A proper breakfast'],
    donts: ['Running on snacks']
  },
  health: {
    heavier: 'Your body has been asking for attention. Listen to it first today.',
    lighter: 'Looking after your body has been paying off.',
    note: 'Your body has been asking for attention. Listen to it first today.',
    noteLighter: 'Looking after your body has been paying off. Keep going.',
    dos: ['Rest without guilt'],
    donts: ['Pushing through it']
  },
  home: {
    heavier: 'Home has felt heavy. Get out of it for a while today.',
    lighter: 'Home has been a good place to be. Make it a little nicer.',
    note: 'A lot of days at home lately. Get some air today.',
    noteLighter: 'Home has been a good place lately. Make it a little nicer today.',
    dos: ['A window open'],
    donts: ['Staying in all day']
  },
  outside: {
    heavier: 'Being out hasn’t helped much lately. Somewhere quieter, maybe.',
    lighter: 'Being outside has been lifting you. Go again.',
    note: 'Being out hasn’t helped much lately. Somewhere quieter, maybe.',
    noteLighter: 'Being outside has been lifting you. Go again today.',
    dos: ['Ten minutes outside'],
    donts: ['Staying in all day']
  },
  travel: {
    heavier: 'Being on the move takes more than it looks. Rest counts as progress.',
    lighter: 'Being somewhere new has been good for you.',
    note: 'Lots of moving around lately. Rest counts as progress.',
    noteLighter: 'Being somewhere new has been good for you. Enjoy it.',
    dos: ['An early night'],
    donts: ['Packing the day too full']
  }
};

/** What someone has been writing about, from their own pages, on the phone. */
const THEMES: { key: string; phrase: string; words: RegExp }[] = [
  { key: 'work', phrase: 'work', words: /\b(work|job|boss|manager|office|deadline|meeting|shift|colleague|coworker|client)s?\b/gi },
  { key: 'study', phrase: 'studying', words: /\b(exam|study|studying|class|college|school|uni|university|assignment|grades?|semester|test)s?\b/gi },
  { key: 'money', phrase: 'money', words: /\b(money|rent|bills?|debt|salary|broke|afford|loan|pay)\b/gi },
  { key: 'family', phrase: 'family', words: /\b(mom|mum|dad|mother|father|parents?|family|sister|brother|sibling)s?\b/gi },
  { key: 'partner', phrase: 'someone close', words: /\b(boyfriend|girlfriend|partner|husband|wife|relationship|breakup|ex|dating)s?\b/gi },
  { key: 'friends', phrase: 'friends', words: /\b(friends?|friendship|bestie)\b/gi },
  { key: 'alone', phrase: 'feeling alone', words: /\b(alone|lonely|loneliness|isolated|nobody)\b/gi },
  { key: 'sleep', phrase: 'sleep', words: /\b(sleep|slept|insomnia|tired|exhausted|awake|nightmare)s?\b/gi },
  { key: 'health', phrase: 'your body', words: /\b(sick|ill|pain|headache|doctor|hospital|body|period)s?\b/gi }
];

// ---------------------------------------------------------------------------
// What today is about

type Focus = {
  key: string;
  weight: number;
  /** For the page. */
  line: string;
  /** For the lock screen. */
  note: string;
  headlines?: readonly string[];
  dos?: readonly string[];
  donts?: readonly string[];
};

/** One of several ways to say a thing — a different one each day (see `rotate`). */
type Say = (pool: readonly string[], salt: string) => string;

function sinceLast(checkIns: readonly CheckIn[], now: Date): CheckIn | undefined {
  let last: CheckIn | undefined;
  for (const c of checkIns) {
    if (new Date(c.createdAt).getTime() > now.getTime()) continue;
    if (!last || c.createdAt > last.createdAt) last = c;
  }
  return last;
}

function gapFocus(last: CheckIn | undefined, now: Date, say: Say): Focus | null {
  if (!last) return null;
  const days = Math.floor((now.getTime() - new Date(last.createdAt).getTime()) / DAY_MS);
  if (days < 3) return null;
  return {
    key: 'gap',
    weight: 3,
    line: `${days > 14 ? 'It’s been a while since your last check-in.' : `It’s been ${days} days since your last check-in.`} ${say(
      ['Nothing to catch up on — today can start from here.', 'No need to explain the gap. One word is enough.', 'Pick it up wherever you are; the days in between still count.'],
      'gap'
    )}`,
    note: 'It’s been a few quiet days. No catching up — one word is enough to start again.',
    headlines: ['Start from here.', 'No need to catch up.', 'Begin where you are.'],
    dos: ['One word, no more'],
    donts: ['Catching up on everything']
  };
}

function nightFocus(lastNight: SleepLog | null, sleep: readonly SleepLog[], now: Date, say: Say): Focus | null {
  if (lastNight && lastNight.minutes < 6 * 60) {
    return {
      key: 'short-night',
      weight: 2.5,
      line: `Last night was ${formatDuration(lastNight.minutes)}. ${say(
        ['Lower the bar a little today — that’s pacing, not giving up.', 'Go easy on the day; it’s running on less.', 'Everything may feel a notch harder today. That’s the night, not you.'],
        'short-night'
      )}`,
      note: 'A short night behind you. Lower the bar a little today.',
      headlines: ['Pace yourself today.', 'Run on less, ask for less.', 'Be gentle with a tired head.'],
      dos: ['An early night', 'A slower morning'],
      donts: ['Caffeine after 2', 'Big asks of yourself']
    };
  }
  if (lastNight && lastNight.minutes >= 8.5 * 60) {
    return {
      key: 'long-night',
      weight: 0.8,
      line: `Last night was ${formatDuration(lastNight.minutes)}. ${say(
        ['See whether the rest shows up in how today feels.', 'A rested head is a good one to start something with.'],
        'long-night'
      )}`,
      note: 'A long night’s sleep behind you. See if it shows today.',
      dos: ['Using the energy']
    };
  }
  const late = nightsSignal(sleep, now);
  if (late) {
    return {
      key: 'late-nights',
      weight: 1.3,
      line: `${late.text} ${say(
        ['An earlier night tonight could do more than anything else on this page.', 'Tonight, try putting the day down half an hour sooner.'],
        'late-nights'
      )}`,
      note: 'Your nights have been running late. An earlier one tonight?',
      dos: ['Lights out a little earlier'],
      donts: ['One more episode']
    };
  }
  return null;
}

/** The last word they chose, if it was recent — named on the page, never in a note. */
function wordFocus(last: CheckIn | undefined, now: Date, say: Say): Focus | null {
  if (!last) return null;
  const at = new Date(last.createdAt);
  const hours = (now.getTime() - at.getTime()) / (60 * 60 * 1000);
  if (hours > 40) return null;
  const when = dateKey(at) === dateKey(now) ? 'Earlier today' : 'Yesterday';
  const word = `“${last.emotion}”`;
  const unpleasant = last.pleasantness < 0;
  const charged = last.energy >= 0;

  if (unpleasant && !charged) {
    return {
      key: 'word',
      weight: 1.6,
      line: say(
        [
          `${when} you named it ${word}. Today doesn’t have to make up for it — just be a little kinder to it.`,
          `${when} felt ${word}. Start small today, and let that be enough.`
        ],
        'word'
      ),
      note:
        when === 'Yesterday'
          ? 'Yesterday was a heavy one. Today doesn’t have to make up for it.'
          : 'A heavy start to the day. The rest of it doesn’t have to make up for it.',
      dos: ['Something warm'],
      donts: ['Pushing through it']
    };
  }
  if (unpleasant) {
    return {
      key: 'word',
      weight: 1.6,
      line: say(
        [
          `${when} you named it ${word}. Whatever it was, it doesn’t need to follow you into every hour of today.`,
          `${when} ran ${word}. Give it somewhere to go — a walk, a page — before it decides the day.`
        ],
        'word'
      ),
      note: when === 'Yesterday' ? 'Yesterday ran hot. Let some of it stay there.' : 'A lot of charge earlier. Let it settle before you act on it.',
      dos: ['Moving your body'],
      donts: ['Replaying it']
    };
  }
  if (charged) {
    return {
      key: 'word',
      weight: 1.3,
      line: say(
        [
          `${when} felt ${word}. Worth noticing what was in it — then making room for more of that.`,
          `${when} you were ${word}. What lit that up? It’s worth knowing.`
        ],
        'word'
      ),
      note: when === 'Yesterday' ? 'Yesterday had some spark in it. What made it?' : 'Some spark in the day already. Follow it.',
      dos: ['Doing it again']
    };
  }
  return {
    key: 'word',
    weight: 1.3,
    line: say(
      [
        `${when} you felt ${word}. Quiet can be a kind of good — keep some of it today.`,
        `${when} was ${word}. Protect a little of that calm today.`
      ],
      'word'
    ),
    note: when === 'Yesterday' ? 'Yesterday was a calm one. Keep a little of that today.' : 'A calm start. Keep a little of it for later.',
    dos: ['A slow start']
  };
}

/** A tag that keeps coming up this week, and which way it leans. */
function tagFocus(checkIns: readonly CheckIn[], facts: readonly Fact[], now: Date, say: Say): Focus | null {
  const from = now.getTime() - 7 * DAY_MS;
  const week = checkIns.filter(c => {
    const t = new Date(c.createdAt).getTime();
    return t >= from && t <= now.getTime();
  });
  const counts = new Map<string, number>();
  for (const c of week) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const [tag, uses] = [...counts.entries()].filter(([t]) => TAGS[t]).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!tag || !uses || uses < 3) return null;

  // The pattern engine's finding if it has one; otherwise how those check-ins felt.
  const fact = facts.find(f => f.key === `tag-${tag}`);
  const tagged = week.filter(c => c.tags.includes(tag));
  const feel = tagged.reduce((sum, c) => sum + c.pleasantness, 0) / tagged.length;
  const lean = fact ? (fact.text.includes('heavier') ? 'heavier' : 'lighter') : feel < 0 ? 'heavier' : 'lighter';
  const advice = TAGS[tag];
  const ran = fact ? `, and those ran ${lean} than the rest` : '';
  const seen = say(
    [
      `“${tag}” came up in ${uses} of your last ${week.length} check-ins${ran}.`,
      `${uses} of your last ${week.length} check-ins were tagged “${tag}”${ran}.`,
      `“${tag}” keeps showing up — ${uses} times this week${ran}.`
    ],
    'tag'
  );
  return {
    key: `tag-${tag}`,
    weight: fact ? 1.8 : 1.3,
    line: `${seen} ${lean === 'lighter' ? advice.lighter : advice.heavier}`,
    note: lean === 'lighter' ? advice.noteLighter : advice.note,
    dos: advice.dos,
    donts: lean === 'lighter' ? [] : advice.donts
  };
}

/** What their pages have been about, these last few days. */
function pageFocus(pages: readonly PageLike[], now: Date, say: Say): Focus | null {
  const from = now.getTime() - 5 * DAY_MS;
  const recent = pages.filter(p => {
    const t = new Date(p.createdAt).getTime();
    return t >= from && t <= now.getTime();
  });
  if (recent.length === 0) return null;

  const text = recent.map(p => p.body).join('\n');
  const scored = THEMES.map(theme => ({ theme, hits: text.match(theme.words)?.length ?? 0 })).sort((a, b) => b.hits - a.hits);
  const top = scored[0];
  if (!top || top.hits < 2) {
    return recent.length >= 3
      ? {
          key: 'pages',
          weight: 1.2,
          line: `${recent.length} pages in the last few days — a lot has needed saying. Let today be lighter on the inside.`,
          note: 'A lot has needed saying lately. Let today be lighter on the inside.',
          dos: ['Writing it down'],
          donts: ['Carrying it all at once']
        }
      : null;
  }
  const advice = TAGS[top.theme.key];
  return {
    key: `page-${top.theme.key}`,
    weight: 1.7,
    line: `${say(
      [
        `You’ve been writing about ${top.theme.phrase} lately.`,
        `Your pages keep coming back to ${top.theme.phrase}.`,
        `${top.theme.phrase.charAt(0).toUpperCase()}${top.theme.phrase.slice(1)} keeps finding its way onto your pages.`
      ],
      'page'
    )} ${advice?.heavier ?? 'Give it ten minutes on paper today, then let it rest.'}`,
    note: 'Something has been on your mind lately. Ten minutes on paper, then let it rest.',
    dos: advice?.dos,
    donts: advice?.donts
  };
}

function trendFocus(checkIns: readonly CheckIn[], now: Date, say: Say): Focus | null {
  const trend = trendSignal(checkIns, now);
  if (!trend) return null;
  return trend.lean === 'heavier'
    ? {
        key: 'trend',
        weight: 1.5,
        line: `The last three days have run heavier than your usual. ${say(
          ['That’s information, not a verdict — make today a little smaller.', 'Not a verdict on you. Cut today down to what matters.'],
          'trend'
        )}`,
        note: 'The last few days have been heavier than usual. Make today a little smaller.',
        headlines: ['Make today smaller.', 'Information, not a verdict.'],
        donts: ['Overcommitting']
      }
    : {
        key: 'trend',
        weight: 1.3,
        line: `The last three days have run lighter than your usual. ${say(
          ['Notice what changed — it’s worth keeping.', 'Whatever you’ve been doing, it might be working.'],
          'trend'
        )}`,
        note: 'Lighter than usual lately. Notice what’s helping.',
        headlines: ['Notice what’s helping.'],
        dos: ['Doing more of it']
      };
}

/** How this weekday has tended to go — a heads-up for the day itself. */
function weekdayFocus(checkIns: readonly CheckIn[], now: Date, say: Say): Focus | null {
  // weekdaySignal reads "tomorrow", so it is asked from yesterday.
  const signal = weekdaySignal(checkIns, new Date(now.getTime() - DAY_MS));
  if (!signal) return null;
  return signal.lean === 'heavier'
    ? {
        key: 'weekday',
        weight: 1.2,
        line: `${signal.text} ${say(['Plan one small thing to look forward to.', 'Knowing that is half of it — go easy.'], 'weekday')}`,
        note: `Heads up: ${signal.text.charAt(0).toLowerCase()}${signal.text.slice(1)} Plan one small good thing.`,
        dos: ['Something to look forward to']
      }
    : {
        key: 'weekday',
        weight: 1,
        line: `${signal.text} A good day to start something.`,
        note: `${signal.text} A good day to start something.`,
        dos: ['Starting something']
      };
}

const LIGHT_FACTS = new Set(['pleasant', 'high-energy']);

/** One of the week's plain facts, and what to do with it. */
function factFocus(facts: readonly Fact[], say: Say): Focus | null {
  const fact = facts.find(f => f.key !== 'days' && !f.key.startsWith('tag-'));
  if (!fact) return null;
  const then = LIGHT_FACTS.has(fact.key)
    ? say(['Notice what’s helping, so you can find it again.', 'Spend a bit of it on something you love.', 'Enjoy it — no need to explain it.'], 'fact')
    : say(['Let today ask a little less of you.', 'Be on your own side today.', 'Small comforts count double right now.'], 'fact');
  return { key: fact.key, weight: 0.9, line: `${fact.text} ${then}`, note: '' };
}

// ---------------------------------------------------------------------------
// The reading

/**
 * What today is about: weighted, so the strongest signal leads most days —
 * but not the same one two days running when there is anything else to say.
 */
function chooseLead(candidates: readonly Focus[], seed: string, date: string): Focus | undefined {
  const draw = (day: string) => weighted(candidates, stream(`${seed}|${day}|lead`));
  const lead = draw(date);
  if (!lead || candidates.length < 2) return lead;
  const [y, m, d] = date.split('-').map(Number);
  if (draw(dateKey(new Date(y, m - 1, d - 1)))?.key !== lead.key) return lead;
  return weighted(
    candidates.filter(c => c.key !== lead.key),
    stream(`${seed}|${date}|instead`)
  );
}

export type ReadingInput = {
  weather: Weather | null;
  /** The found facts, strongest first (patterns.ts). */
  facts: readonly Fact[];
  checkIns: readonly CheckIn[];
  sleep: readonly SleepLog[];
  lastNight: SleepLog | null;
  pages?: readonly PageLike[];
  now: Date;
  /** The day being read, YYYY-MM-DD. */
  date: string;
  /** Whose day it is — the account id. */
  seed: string;
};

function fill(first: readonly (string | undefined)[], pool: readonly string[], next: () => number): string[] {
  const out: string[] = [];
  for (const item of [...first, ...shuffled(pool, next)]) {
    if (item && !out.includes(item)) out.push(item);
    if (out.length === 3) break;
  }
  return out;
}

/** With readings off (or nothing yet): general, but still a different one each day. */
export function generalReading(seed: string, date: string): Reading {
  const next = stream(`${seed}|${date}|general`);
  return {
    headline: rotate(GENERAL.headlines, seed, date),
    subtext: rotate(GENERAL.lines, `${seed}|line`, date),
    dos: shuffled(GENERAL.dos, next).slice(0, 3),
    donts: shuffled(GENERAL.donts, next).slice(0, 3),
    note: rotate(GENERAL.notes, `${seed}|note`, date)
  };
}

export function writeReading(input: ReadingInput): Reading {
  const { weather, seed, date, now } = input;
  if (!weather) return generalReading(seed, date);

  const voice = BY_WEATHER[weather];
  const next = stream(`${seed}|${date}`);
  const say: Say = (pool, salt) => rotate(pool, `${seed}|${salt}`, date);
  const last = sinceLast(input.checkIns, now);

  const candidates = [
    gapFocus(last, now, say),
    nightFocus(input.lastNight, input.sleep, now, say),
    wordFocus(last, now, say),
    tagFocus(input.checkIns, input.facts, now, say),
    pageFocus(input.pages ?? [], now, say),
    trendFocus(input.checkIns, now, say),
    weekdayFocus(input.checkIns, now, say),
    factFocus(input.facts, say)
  ].filter((f): f is Focus => f !== null);

  const lead = chooseLead(candidates, seed, date);
  const second = weighted(
    candidates.filter(c => c !== lead),
    next
  );

  // Half the time a lead with its own headlines speaks first; otherwise the weather does.
  const headline = lead?.headlines && next() < 0.5 ? rotate(lead.headlines, seed, date) : rotate(voice.headlines, seed, date);
  const subtext = lead?.line ?? rotate(voice.lines, `${seed}|line`, date);
  const note = lead?.note || rotate(voice.notes, `${seed}|note`, date);

  return {
    headline,
    subtext,
    dos: fill([lead?.dos?.[0], second?.dos?.[0], lead?.dos?.[1]], voice.dos, next),
    donts: fill([lead?.donts?.[0], second?.donts?.[0], lead?.donts?.[1]], voice.donts, next),
    note
  };
}

export { dateKey as readingDate };
