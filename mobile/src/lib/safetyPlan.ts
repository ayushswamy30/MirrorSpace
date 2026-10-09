import { kv } from './db/kv';

/**
 * A personal safety plan (report §5: "a plan the user fills in, one tap to
 * open"), following the steps of safety-planning practice: notice the signs,
 * cope alone, reach for distraction, then for people, then for
 * professionals, make the space safer, and remember why. The wording is
 * Lowkei's own and, like helplines.ts, must be reviewed by the clinical
 * advisory board before release.
 *
 * Stored only on this phone, in the encrypted database.
 */

export type SectionKey =
  | 'warningSigns'
  | 'coping'
  | 'distractions'
  | 'people'
  | 'professionals'
  | 'safeSpace'
  | 'reasons';

export type PlanItem = { text: string; phone?: string };

export type SafetyPlan = Record<SectionKey, PlanItem[]> & { updatedAt: string | null };

export type SectionDef = {
  key: SectionKey;
  title: string;
  /** The question the section asks, in the writing prompt's italic. */
  prompt: string;
  placeholder: string;
  /** People and services get a number to call. */
  withPhone?: boolean;
};

export const SECTIONS: readonly SectionDef[] = [
  {
    key: 'warningSigns',
    title: 'warning signs',
    prompt: 'What tells you a hard moment is starting?',
    placeholder: 'a thought, a feeling, a time of night'
  },
  {
    key: 'coping',
    title: 'on my own',
    prompt: 'What can you do by yourself to get through it?',
    placeholder: 'a walk, a shower, a song'
  },
  {
    key: 'distractions',
    title: 'places and company',
    prompt: 'Where could you go, or who could you be around, to take your mind off it?',
    placeholder: 'a café, a friend’s place'
  },
  {
    key: 'people',
    title: 'people to ask',
    prompt: 'Who could you tell that you’re struggling?',
    placeholder: 'a name',
    withPhone: true
  },
  {
    key: 'professionals',
    title: 'professionals',
    prompt: 'Which professionals or services could you contact?',
    placeholder: 'a doctor, a counsellor, a helpline',
    withPhone: true
  },
  {
    key: 'safeSpace',
    title: 'a safer space',
    prompt: 'What could you move away, or ask someone to hold for you, to make things safer?',
    placeholder: 'something to put out of reach'
  },
  {
    key: 'reasons',
    title: 'reasons',
    prompt: 'What matters most to you, and is worth staying for?',
    placeholder: 'a person, a place, a plan'
  }
];

const KEY = 'safetyPlan.v1';

export function emptyPlan(): SafetyPlan {
  return {
    warningSigns: [],
    coping: [],
    distractions: [],
    people: [],
    professionals: [],
    safeSpace: [],
    reasons: [],
    updatedAt: null
  };
}

export function isEmpty(plan: SafetyPlan): boolean {
  return SECTIONS.every(s => plan[s.key].length === 0);
}

export async function loadPlan(): Promise<SafetyPlan> {
  const raw = await kv.get(KEY);
  if (!raw) return emptyPlan();
  try {
    return { ...emptyPlan(), ...(JSON.parse(raw) as Partial<SafetyPlan>) };
  } catch {
    return emptyPlan();
  }
}

export async function savePlan(plan: SafetyPlan, now: Date = new Date()): Promise<SafetyPlan> {
  const saved = { ...plan, updatedAt: now.toISOString() };
  await kv.set(KEY, JSON.stringify(saved));
  return saved;
}

/** Digits and a leading +, or null when there is nothing dialable. */
export function dialable(phone: string | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 3) return null;
  return (trimmed.startsWith('+') ? '+' : '') + digits;
}

export function addItem(plan: SafetyPlan, key: SectionKey, item: PlanItem): SafetyPlan {
  const text = item.text.trim();
  if (!text) return plan;
  const phone = item.phone?.trim() || undefined;
  return { ...plan, [key]: [...plan[key], phone ? { text, phone } : { text }] };
}

export function removeItem(plan: SafetyPlan, key: SectionKey, index: number): SafetyPlan {
  return { ...plan, [key]: plan[key].filter((_, i) => i !== index) };
}
