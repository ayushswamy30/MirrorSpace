/**
 * What each consent means, in the words the person actually reads.
 *
 * Each purpose gets its own screen (India's DPDP Rules want standalone,
 * itemised notice; the report ships those screens with the MVP). Changing any
 * of this wording is a new policy version: bump CONSENT_POLICY_VERSION so the
 * server's consent log can tell the two apart.
 *
 * `health` is not asked during onboarding — it is asked in context, the first
 * time the person connects Apple Health or Health Connect. `circle` likewise,
 * the first time they start a circle.
 */

export const CONSENT_POLICY_VERSION = '2026-10-08';

export type ConsentPurpose = 'readings' | 'ai_reflections' | 'health' | 'circle';

export type ConsentCopy = {
  title: string;
  sends: string[];
  neverSends: string[];
  declined: string;
};

export const consentCopy: Record<ConsentPurpose, ConsentCopy> = {
  readings: {
    title: 'May Lowkei use your numbers to write your daily reading?',
    sends: [
      'Counts and averages from your check-ins and sleep — for example “slept 5h 40m” or “energy low three days running”.'
    ],
    neverSends: ['What you write. Your words stay on this phone.'],
    declined: 'Your reading will be a general one, not built from your patterns.'
  },
  ai_reflections: {
    title: 'May Lowkei send what you write in Vent and Mirror to an AI, to reflect it back?',
    sends: [
      'The text of an entry or message, once, to write a reflection on it.',
      // True of Groq's terms as of 2026-10: no training on inputs or outputs on
      // any plan, nothing retained by default (up to 30 days only for abuse
      // checks, off with Zero Data Retention). Change the provider, change
      // this line — and CONSENT_POLICY_VERSION with it.
      'It passes through our server to Groq, the AI service that writes reflections. Groq doesn’t train on it or keep it, and our server doesn’t keep it either — only the reflection is saved.',
      'Only if you switch it on under “What the Mirror knows”: the patterns and notes on that page, with each Mirror message.'
    ],
    neverSends: ['Anything you keep only on this phone without asking for a reflection.'],
    declined: 'Vent still works and stays private; you won’t get reflections, and Mirror chat stays closed.'
  },
  health: {
    title: 'May Lowkei read your sleep from your phone’s health data?',
    sends: [
      'Sleep and wake times, turned into numbers like “in bed at 01:40” before they leave the phone.',
      'Only if you also allow it, as a second step: daily steps, resting heart rate and heart-rate variability. These stay on this phone and are never sent anywhere.'
    ],
    neverSends: ['Anything else in your health record — workouts, weight, medicines, anything not named here.'],
    declined: 'You can log sleep by hand instead.'
  },
  circle: {
    title: 'May Lowkei show the people in your circle how your days are going?',
    sends: [
      'Today’s Inner Weather — one word, like “fog” or “clear”.',
      'That you’re “running low”, when you say so. It clears itself after a day.',
      'Which days of the week tend to be lighter or heavier for you, as seven numbers — so the app can say “you both run heavy on Thursdays”.'
    ],
    neverSends: ['Your words, notes, pages or Mirror. Not which feelings you chose — only the weather they make.'],
    declined: 'You can still see your friends and accept them; they just won’t see anything of yours.'
  }
};

/** Asked during onboarding, in this order. */
export const onboardingPurposes: ConsentPurpose[] = ['readings', 'ai_reflections'];

export const withdrawNote = 'You can change this at any time, and saying no now changes nothing else.';
