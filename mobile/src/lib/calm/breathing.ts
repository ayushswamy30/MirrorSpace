/**
 * Breathing patterns for the calm tools. Pure timing only — the screen asks
 * "where in the pattern are we, this many milliseconds in?" and draws that, so
 * a dropped frame or a slow phone never makes the rhythm drift.
 */

export type PhaseKind = 'in' | 'hold' | 'out';

export type Phase = {
  kind: PhaseKind;
  seconds: number;
  /** What the screen says during this phase. */
  cue: string;
};

export type Pattern = {
  key: 'box' | 'sigh' | 'four-seven-eight';
  name: string;
  /** One line under the name, in the list. */
  summary: string;
  phases: readonly Phase[];
  /** Rounds before it ends on its own. */
  rounds: number;
};

export const PATTERNS: readonly Pattern[] = [
  {
    key: 'sigh',
    name: 'Double sigh',
    summary: 'in, a second sip in, a long sigh out',
    phases: [
      { kind: 'in', seconds: 2, cue: 'breathe in through the nose' },
      { kind: 'in', seconds: 1, cue: 'one more small breath in' },
      { kind: 'out', seconds: 6, cue: 'long sigh out through the mouth' }
    ],
    rounds: 6
  },
  {
    key: 'box',
    name: 'Box breathing',
    summary: '4 in · 4 hold · 4 out · 4 hold',
    phases: [
      { kind: 'in', seconds: 4, cue: 'breathe in' },
      { kind: 'hold', seconds: 4, cue: 'hold' },
      { kind: 'out', seconds: 4, cue: 'breathe out' },
      { kind: 'hold', seconds: 4, cue: 'hold' }
    ],
    rounds: 5
  },
  {
    key: 'four-seven-eight',
    name: '4 · 7 · 8',
    summary: '4 in · 7 hold · 8 out, for falling asleep',
    phases: [
      { kind: 'in', seconds: 4, cue: 'breathe in through the nose' },
      { kind: 'hold', seconds: 7, cue: 'hold' },
      { kind: 'out', seconds: 8, cue: 'breathe out slowly through the mouth' }
    ],
    rounds: 4
  }
];

export function roundSeconds(pattern: Pattern): number {
  return pattern.phases.reduce((sum, phase) => sum + phase.seconds, 0);
}

export function totalSeconds(pattern: Pattern): number {
  return roundSeconds(pattern) * pattern.rounds;
}

export type Moment =
  | { done: true }
  | {
      done: false;
      phase: Phase;
      /** Index of the phase within the round. */
      phaseIndex: number;
      /** 1-based. */
      round: number;
      /** Whole seconds left in this phase, counting down to 1. */
      secondsLeft: number;
    };

/** Where the pattern is `elapsedMs` after it started. */
export function momentAt(pattern: Pattern, elapsedMs: number): Moment {
  const elapsed = Math.max(0, elapsedMs) / 1000;
  if (elapsed >= totalSeconds(pattern)) return { done: true };

  const perRound = roundSeconds(pattern);
  const round = Math.floor(elapsed / perRound);
  let within = elapsed - round * perRound;

  for (let i = 0; i < pattern.phases.length; i++) {
    const phase = pattern.phases[i];
    if (within < phase.seconds) {
      return {
        done: false,
        phase,
        phaseIndex: i,
        round: round + 1,
        secondsLeft: Math.ceil(phase.seconds - within)
      };
    }
    within -= phase.seconds;
  }
  // Floating-point edge at the very end of a round.
  return momentAt(pattern, (round + 1) * perRound * 1000);
}
