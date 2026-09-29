/**
 * 5-4-3-2-1 grounding: one sense at a time, counting down, to bring attention
 * back into the room. One step per screen, never a checklist to complete.
 */

export type GroundingStep = {
  count: number;
  sense: string;
  prompt: string;
};

export const GROUNDING_STEPS: readonly GroundingStep[] = [
  { count: 5, sense: 'see', prompt: 'Name five things you can see. Small ones count.' },
  { count: 4, sense: 'feel', prompt: 'Notice four things you can feel — your feet, the chair, the air.' },
  { count: 3, sense: 'hear', prompt: 'Listen for three sounds, near or far.' },
  { count: 2, sense: 'smell', prompt: 'Find two things you can smell, or two you like the smell of.' },
  { count: 1, sense: 'taste', prompt: 'Notice one thing you can taste, even if it is just your mouth.' }
];
