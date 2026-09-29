import { normalise, screenCheckIn, screenText, type Tier } from '../screen';

/**
 * Red-team suite for the keyword backstop. When a real miss or false alarm is
 * found, add it here first, then change the lists until it passes.
 */

const cases: [string, Tier][] = [
  // acute — intent with a plan, method, time or goodbye
  ['I am going to kill myself', 'acute'],
  ['im gonna end it all tonight', 'acute'],
  ['I have the pills ready', 'acute'],
  ['wrote my goodbye letter', 'acute'],
  ['I took all my pills', 'acute'],
  ['thinking about an overdose', 'acute'],
  ['I want to jump off the bridge', 'acute'],
  ['this is goodbye', 'acute'],
  ['I will kill myself tonight', 'acute'],

  // elevated — suicidal thoughts or self-harm
  ['I want to die', 'elevated'],
  ['sometimes i feel suicidal', 'elevated'],
  ['everyone would be better off without me', 'elevated'],
  ['I never want to wake up', 'elevated'],
  ['been cutting myself again', 'elevated'],
  ['I wish I wasn’t born', 'elevated'],
  ['no point in living', 'elevated'],
  ['i cant go on like this', 'elevated'],
  ['self-harm urges', 'elevated'],

  // low — hopelessness and isolation
  ['everything feels hopeless', 'low'],
  ['nobody would notice', 'low'],
  ['I can’t cope with work', 'low'],
  ['I feel so alone', 'low'],
  ['I hate myself for that', 'low'],

  // denials are lowered one tier, never to nothing
  ['I’m not going to kill myself, just tired', 'elevated'],
  ['I would never hurt myself', 'low'],
  ['I don’t want to die, I want this to stop', 'low'],

  // everyday language must stay quiet
  ['work was killing me today but the walk helped', 'none'],
  ['this song is to die for', 'none'],
  ['finally finished my essay', 'none'],
  ['skillful, mysterious', 'none'],
  ['', 'none']
];

test.each(cases)('%j → %s', (text, tier) => {
  expect(screenText(text)).toBe(tier);
});

test('shouting, punctuation and curly apostrophes change nothing', () => {
  expect(screenText('I WANT TO DIE!!!')).toBe('elevated');
  expect(screenText('i...want...to...die')).toBe('elevated');
  expect(normalise('I’m “fine”.')).toBe('im fine');
});

test('the highest tier in a longer note wins', () => {
  expect(screenText('I feel hopeless. I have a plan. I want to die.')).toBe('acute');
});

test('a check-in is screened on its word and its note', () => {
  expect(screenCheckIn({ emotion: 'calm' })).toBe('none');
  expect(screenCheckIn({ emotion: 'hopeless' })).toBe('low');
  expect(screenCheckIn({ emotion: 'despairing', note: null })).toBe('low');
  expect(screenCheckIn({ emotion: 'calm', note: 'I want to die' })).toBe('elevated');
});
