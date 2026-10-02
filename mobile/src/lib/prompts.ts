import { localDate, type CheckIn } from './checkIns';
import { innerWeather } from './patterns';

/**
 * One writing prompt a day (report: "chosen from recent patterns"), with the
 * reason it was chosen shown beneath it. Chosen on the phone from the last
 * week of check-ins; the same all day, so it doesn't change under the pen.
 *
 * And the guided pages: a worry dump, three good things, a letter you won't
 * send — short shapes for when a blank page is too much.
 */

export type Prompt = { text: string; because: string };

const BANK = {
  heavy: [
    'What is the smallest thing that would make tonight a little softer?',
    'What are you carrying that isn’t yours to carry?',
    'If a friend felt like this, what would you tell them?',
    'What does your body need right now — not tomorrow, now?'
  ],
  work: [
    'What did work take from you today, and what did it give back?',
    'Which task is loudest in your head? Write it down so it can be quieter.',
    'What would “enough for today” have looked like?'
  ],
  sleep: [
    'What keeps you up when you’d rather be asleep?',
    'What would a slower last hour of the day look like?',
    'How does a good night change the next day for you?'
  ],
  people: [
    'Who made a day lighter lately — and do they know?',
    'Which conversation is still going on in your head?',
    'Who would you like to be closer to, and what’s one small step?'
  ],
  bright: [
    'What went right, even a little?',
    'What do you want to remember about these days?',
    'What gave you energy this week that you’d like more of?'
  ],
  quiet: [
    'What’s been on your mind that you haven’t said out loud?',
    'Describe today in three words, then say why those three.',
    'What are you looking forward to, however small?',
    'What would you like to let go of this week?'
  ]
} as const;

/** A stable pick for the day, so the prompt doesn't change between visits. */
function pick<T>(list: readonly T[], day: string): T {
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
}

export function dailyPrompt(checkIns: readonly CheckIn[], now: Date = new Date()): Prompt {
  const day = localDate(now);
  const week = checkIns.filter(c => now.getTime() - new Date(c.createdAt).getTime() < 7 * 24 * 3600 * 1000);
  const tagged = (tags: string[]) => week.filter(c => c.tags.some(t => tags.includes(t))).length;
  const weather = innerWeather(checkIns, now);

  if (weather === 'fog' || weather === 'storm') return { text: pick(BANK.heavy, day), because: `chosen because the last days read as ${weather}` };
  const work = tagged(['work', 'study']);
  const sleep = tagged(['sleep']);
  const people = tagged(['family', 'partner', 'friends']);
  const top = Math.max(work, sleep, people);
  if (top >= 2) {
    if (top === work) return { text: pick(BANK.work, day), because: `chosen because ${work} check-ins this week mention work or study` };
    if (top === sleep) return { text: pick(BANK.sleep, day), because: `chosen because sleep came up ${sleep} times this week` };
    return { text: pick(BANK.people, day), because: `chosen because people came up ${people} times this week` };
  }
  if (weather === 'clear' || weather === 'mild') return { text: pick(BANK.bright, day), because: `chosen because the last days read as ${weather}` };
  return { text: pick(BANK.quiet, day), because: week.length ? 'a prompt for an ordinary day' : 'a prompt to begin with' };
}

export type PageKind = 'page' | 'worry' | 'thanks' | 'unsent';

export type Template = {
  kind: PageKind;
  label: string;
  /** The question the sheet asks. */
  prompt: string;
  placeholder: string;
  /** Numbered lines instead of one sheet. */
  lines?: number;
  /** A "Dear ___" line above the sheet. */
  salutation?: boolean;
};

export const TEMPLATES: Template[] = [
  { kind: 'page', label: 'page', prompt: '', placeholder: 'start anywhere' },
  {
    kind: 'worry',
    label: 'worry dump',
    prompt: 'Everything on your mind, one per line. Don’t sort it — just get it out.',
    placeholder: 'the rent\nthat message I haven’t answered\n…'
  },
  { kind: 'thanks', label: 'three good things', prompt: 'Three things that went right, however small.', placeholder: '', lines: 3 },
  {
    kind: 'unsent',
    label: 'unsent letter',
    prompt: 'A letter you’ll never send. Say what you couldn’t say.',
    placeholder: 'what I wanted to tell you is…',
    salutation: true
  }
];

/** The page as it's kept: a template's shape folded into plain text. */
export function composePage(template: Template, parts: { text: string; lines: string[]; to: string }): string {
  if (template.lines) {
    return parts.lines
      .map(l => l.trim())
      .filter(Boolean)
      .map((l, i) => `${i + 1}. ${l}`)
      .join('\n');
  }
  if (template.salutation && parts.to.trim()) return `Dear ${parts.to.trim()},\n\n${parts.text.trim()}`;
  return parts.text.trim();
}
