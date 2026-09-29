/**
 * The check-in vocabulary (report §5): an energy × pleasantness grid of 100
 * words, so a check-in names a feeling rather than scoring it 1–5 — labelling
 * an emotion is the mechanism the research supports, not rating it.
 *
 * Each quadrant is a 5 × 5 block written from its outer corner inwards: the
 * first row is the most (or least) energy, the first word in a row the most
 * (or least) pleasant. Coordinates are derived from that position, so a word's
 * place in the block *is* its value, from ±5 at the corner to ±1 near the
 * centre. There is no zero: every feeling leans one way on both axes.
 *
 * Check-ins store the word's coordinates alongside the word, so editing this
 * list later never rewrites what someone already recorded.
 */

export type Quadrant = 'charged-unpleasant' | 'charged-pleasant' | 'low-unpleasant' | 'low-pleasant';

export type Emotion = {
  word: string;
  quadrant: Quadrant;
  /** -5 (depleted) … 5 (charged), never 0. */
  energy: number;
  /** -5 (unpleasant) … 5 (pleasant), never 0. */
  pleasantness: number;
};

type Block = readonly [
  readonly [string, string, string, string, string],
  readonly [string, string, string, string, string],
  readonly [string, string, string, string, string],
  readonly [string, string, string, string, string],
  readonly [string, string, string, string, string]
];

const blocks: Record<Quadrant, { energy: 1 | -1; pleasantness: 1 | -1; words: Block }> = {
  'charged-unpleasant': {
    energy: 1,
    pleasantness: -1,
    words: [
      ['enraged', 'furious', 'panicked', 'frantic', 'shocked'],
      ['livid', 'terrified', 'overwhelmed', 'alarmed', 'jittery'],
      ['angry', 'anxious', 'stressed', 'restless', 'wired'],
      ['frustrated', 'worried', 'tense', 'pressured', 'uneasy'],
      ['irritated', 'nervous', 'annoyed', 'impatient', 'on edge']
    ]
  },
  'charged-pleasant': {
    energy: 1,
    pleasantness: 1,
    words: [
      ['ecstatic', 'elated', 'thrilled', 'exhilarated', 'energised'],
      ['joyful', 'inspired', 'excited', 'eager', 'lively'],
      ['delighted', 'proud', 'motivated', 'playful', 'upbeat'],
      ['grateful', 'happy', 'hopeful', 'cheerful', 'curious'],
      ['loving', 'glad', 'focused', 'engaged', 'pleasant']
    ]
  },
  'low-unpleasant': {
    energy: -1,
    pleasantness: -1,
    words: [
      ['despairing', 'hopeless', 'depressed', 'numb', 'exhausted'],
      ['miserable', 'lonely', 'empty', 'drained', 'burnt out'],
      ['sad', 'disheartened', 'discouraged', 'down', 'tired'],
      ['hurt', 'disappointed', 'gloomy', 'apathetic', 'bored'],
      ['lost', 'left out', 'low', 'dull', 'sluggish']
    ]
  },
  'low-pleasant': {
    energy: -1,
    pleasantness: 1,
    words: [
      ['blissful', 'serene', 'tranquil', 'peaceful', 'sleepy'],
      ['content', 'fulfilled', 'cosy', 'relaxed', 'restful'],
      ['loved', 'safe', 'calm', 'at ease', 'mellow'],
      ['tender', 'comfortable', 'balanced', 'settled', 'easygoing'],
      ['warm', 'secure', 'unhurried', 'steady', 'okay']
    ]
  }
};

/** Grid reading order: charged above low, unpleasant before pleasant. */
export const QUADRANTS: readonly Quadrant[] = [
  'charged-unpleasant',
  'charged-pleasant',
  'low-unpleasant',
  'low-pleasant'
];

export const quadrantLabel: Record<Quadrant, string> = {
  'charged-unpleasant': 'charged · unpleasant',
  'charged-pleasant': 'charged · pleasant',
  'low-unpleasant': 'low · unpleasant',
  'low-pleasant': 'low · pleasant'
};

function expand(quadrant: Quadrant): Emotion[] {
  const { energy, pleasantness, words } = blocks[quadrant];
  return words.flatMap((row, r) =>
    row.map((word, c) => ({
      word,
      quadrant,
      energy: energy * (5 - r),
      pleasantness: pleasantness * (5 - c)
    }))
  );
}

export const EMOTIONS: readonly Emotion[] = QUADRANTS.flatMap(expand);

const byWord = new Map(EMOTIONS.map(e => [e.word, e]));

export function findEmotion(word: string): Emotion | undefined {
  return byWord.get(word);
}

/**
 * A quadrant's words as the screen lists them: nearest the centre first. The
 * everyday feelings — tired, calm, uneasy — sit near the centre, so they are
 * the shortest reach; the extremes are further down, still one tap away.
 */
export function wordsNearestFirst(quadrant: Quadrant): Emotion[] {
  return EMOTIONS.filter(e => e.quadrant === quadrant).sort(
    (a, b) =>
      Math.abs(a.energy) + Math.abs(a.pleasantness) - (Math.abs(b.energy) + Math.abs(b.pleasantness)) ||
      Math.abs(a.energy) - Math.abs(b.energy)
  );
}
