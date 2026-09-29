/**
 * What each consent means, in the words the person actually reads.
 *
 * Each purpose gets its own screen (India's DPDP Rules want standalone,
 * itemised notice; the report ships those screens with the MVP). Changing any
 * of this wording is a new policy version: bump CONSENT_POLICY_VERSION so the
 * server's consent log can tell the two apart.
 *
 * `health` is not asked during onboarding — it is asked in context, the first
 * time the person connects Apple Health or Health Connect.
 */

export const CONSENT_POLICY_VERSION = '2026-10-01';

export type ConsentPurpose = 'readings' | 'ai_reflections' | 'health';

export type ConsentCopy = {
  title: string;
  sends: string[];
  neverSends: string[];
  declined: string;
};

export const consentCopy: Record<ConsentPurpose, ConsentCopy> = {
  readings: {
    title: 'May MirrorSpace use your numbers to write your daily reading?',
    sends: [
      'Counts and averages from your check-ins and sleep — for example “slept 5h 40m” or “energy low three days running”.'
    ],
    neverSends: ['What you write. Your words stay on this phone.'],
    declined: 'Your reading will be a general one, not built from your patterns.'
  },
  ai_reflections: {
    title: 'May MirrorSpace send what you write in Vent and Mirror to an AI, to reflect it back?',
    sends: [
      'The text of an entry or message, once, to write a reflection on it.',
      // Say nothing here about the provider's training or retention terms
      // until a provider has actually been chosen against them (report §13,
      // open questions). Consent copy must be true on the day it is shown.
      'It passes through our server to the AI provider that writes reflections. Our server does not keep it — only the reflection is saved.'
    ],
    neverSends: ['Anything you keep only on this phone without asking for a reflection.'],
    declined: 'Vent still works and stays private; you won’t get reflections, and Mirror chat stays closed.'
  },
  health: {
    title: 'May MirrorSpace read your sleep from your phone’s health data?',
    sends: ['Sleep and wake times, turned into numbers like “in bed at 01:40” before they leave the phone.'],
    neverSends: ['Anything else in your health record.'],
    declined: 'You can log sleep by hand instead.'
  }
};

/** Asked during onboarding, in this order. */
export const onboardingPurposes: ConsentPurpose[] = ['readings', 'ai_reflections'];

export const withdrawNote = 'You can change this at any time, and saying no now changes nothing else.';
