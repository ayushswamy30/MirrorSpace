/**
 * On-device crisis screening (report §8, crisis protocol).
 *
 * This is the keyword backstop layer: deterministic phrase rules that run on
 * the phone, need no network, and never send the text anywhere. It is tuned
 * to prefer a false alarm to a miss — a gentle line shown to someone who is
 * fine costs little; silence towards someone who is not costs everything.
 *
 * SAFETY-CRITICAL. Like helplines.ts, every phrase list here must be reviewed
 * by the clinical advisory board before each release, and the red-team suite
 * in __tests__/screen.test.ts extended whenever a miss or false alarm is
 * found. English only for now; each launch language needs its own lists.
 */

export type Tier = 'none' | 'low' | 'elevated' | 'acute';

const rank: Record<Tier, number> = { none: 0, low: 1, elevated: 2, acute: 3 };

export function higher(a: Tier, b: Tier): Tier {
  return rank[a] >= rank[b] ? a : b;
}

export function atLeast(tier: Tier, floor: Tier): boolean {
  return rank[tier] >= rank[floor];
}

const down: Record<Tier, Tier> = { none: 'none', low: 'low', elevated: 'low', acute: 'elevated' };

/*
 * Phrases are written against normalised text: lower case, apostrophes
 * removed ("don't" → "dont", "I'm" → "im"), everything else that isn't a
 * letter or digit turned into a single space.
 */

// Intent with a plan, a method, a time, or a goodbye.
const ACUTE = [
  String.raw`(going|gonna|about|planning|plan|decided) to (kill myself|end (my life|it all)|take my (own )?life)`,
  String.raw`(kill myself|end (my life|it all)|take my (own )?life) (tonight|today|now|this week)`,
  String.raw`i (have|bought|got) (a plan|the pills|pills|a rope|a gun|a blade)`,
  String.raw`(wrote|writing|written|write) (a|my) (suicide|goodbye) (note|letter)`,
  String.raw`(took|swallowed) (all|a lot|too many) (of )?(the |my )?(pills|tablets)`,
  String.raw`overdos(e|ed|ing)`,
  String.raw`(jump|jumping) (off|from) (a|the) (bridge|roof|building|balcony)`,
  String.raw`this is (my )?goodbye`
];

// Suicidal thoughts or self-harm, without the markers above.
const ELEVATED = [
  String.raw`kill(ing)? myself`,
  String.raw`suicid(e|al)`,
  String.raw`end (my life|it all)`,
  String.raw`take my (own )?life`,
  String.raw`(want|wanna|wanted) to die`,
  String.raw`wish i (was|were) dead`,
  String.raw`wish i (wasnt|werent|hadnt been) (here|alive|born)`,
  String.raw`better off (dead|without me)`,
  String.raw`no (reason|point) (to|in) (live|living|going on|being alive)`,
  String.raw`(dont|never) want to (live|be alive|wake up|exist)`,
  String.raw`(hurt|hurting|harm|harming|cut|cutting|burn|burning) myself`,
  String.raw`self ?harm(ing)?`,
  String.raw`cant go on`,
  String.raw`not worth living`,
  String.raw`(disappear|vanish) forever`
];

// Hopelessness and isolation: worth a quiet word, not an interruption.
const LOW = [
  String.raw`hopeless`,
  String.raw`worthless`,
  String.raw`(no one|nobody) (cares|would care|would notice|would miss me)`,
  String.raw`cant (cope|do this anymore|take (it|this) anymore)`,
  String.raw`(so|completely|totally|all) alone`,
  String.raw`(a|such a) burden`,
  String.raw`give up on everything`,
  String.raw`whats the point`,
  String.raw`trapped`,
  String.raw`empty inside`,
  String.raw`hate myself`
];

// A denial just before a phrase ("I'm not going to kill myself", "I would
// never hurt myself") lowers it one tier — it still gets a response, because
// talking about it at all is worth one.
const NEGATORS = new Set(['not', 'dont', 'never', 'wont', 'wouldnt', 'didnt', 'isnt', 'arent']);
const NEGATION_WINDOW = 3;

function compile(list: readonly string[]): RegExp[] {
  return list.map(source => new RegExp(String.raw`(?:^| )(?:${source})(?= |$)`, 'g'));
}

const rules: readonly [Tier, RegExp[]][] = [
  ['acute', compile(ACUTE)],
  ['elevated', compile(ELEVATED)],
  ['low', compile(LOW)]
];

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function negated(text: string, matchStart: number): boolean {
  const before = text.slice(0, matchStart).split(' ').filter(Boolean).slice(-NEGATION_WINDOW);
  return before.some(word => NEGATORS.has(word));
}

/** The highest tier any phrase in the text reaches. */
export function screenText(text: string): Tier {
  const normal = normalise(text);
  if (!normal) return 'none';

  let result: Tier = 'none';
  for (const [tier, patterns] of rules) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of normal.matchAll(pattern)) {
        const start = match.index + (match[0].startsWith(' ') ? 1 : 0);
        result = higher(result, negated(normal, start) ? down[tier] : tier);
        if (result === 'acute') return result;
      }
    }
  }
  return result;
}

/** Check-in words that on their own merit the gentle line. */
const LOW_WORDS = new Set(['despairing', 'hopeless']);

/** Every check-in is screened: the word chosen, and the note if there is one. */
export function screenCheckIn({ emotion, note }: { emotion: string; note?: string | null }): Tier {
  const word: Tier = LOW_WORDS.has(emotion) ? 'low' : 'none';
  return higher(word, note ? screenText(note) : 'none');
}
