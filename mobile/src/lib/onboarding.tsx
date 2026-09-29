import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { api } from './api';
import { CONSENT_POLICY_VERSION, type ConsentPurpose } from './consent';
import { kv } from './db/kv';

/**
 * Onboarding answers are held here until the last screen and sent in one
 * request, so leaving halfway records nothing.
 */

export const INTENTS = [
  { key: 'understand_mind', label: 'understand why I feel the way I do' },
  { key: 'reduce_anxiety', label: 'feel less on edge' },
  { key: 'sleep_better', label: 'sleep and rest better' },
  { key: 'vent_without_judgment', label: 'somewhere to put things down' }
] as const;

export type IntentKey = (typeof INTENTS)[number]['key'];

type Draft = {
  intents: IntentKey[];
  consents: Partial<Record<ConsentPurpose, boolean>>;
};

type OnboardingValue = {
  draft: Draft;
  toggleIntent: (key: IntentKey) => void;
  setConsent: (purpose: ConsentPurpose, granted: boolean) => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ intents: [], consents: {} });

  const value = useMemo<OnboardingValue>(
    () => ({
      draft,
      toggleIntent: key =>
        setDraft(d => ({
          ...d,
          intents: d.intents.includes(key) ? d.intents.filter(k => k !== key) : [...d.intents, key]
        })),
      setConsent: (purpose, granted) => setDraft(d => ({ ...d, consents: { ...d.consents, [purpose]: granted } }))
    }),
    [draft]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return value;
}

/** The body PUT /user/onboarding expects. Exported for the test. */
export function onboardingPayload(draft: Draft) {
  const consents = {
    readings: draft.consents.readings === true,
    ai_reflections: draft.consents.ai_reflections === true
  };

  return {
    intents: draft.intents,
    // The legacy permissions object the web client also writes. Journaling is
    // on-device and needs no permission; health is asked for later, in context.
    permissions: {
      sleepTracking: false,
      journaling: true,
      chatReflections: consents.ai_reflections
    },
    ageConfirmed: true,
    aiDisclosureSeen: true,
    consents,
    policyVersion: CONSENT_POLICY_VERSION
  };
}

export async function submitOnboarding(draft: Draft): Promise<void> {
  await api.put('/user/onboarding', onboardingPayload(draft));
}

// ---------------------------------------------------------------------------
// Age gate
// ---------------------------------------------------------------------------
// Someone who says they are under 18 is not let in, and the answer is kept on
// the device so the gate does not simply reappear with a different answer on
// the next launch. It is never sent to the server.

const UNDER_18_KEY = 'age.under18';

export const ageGate = {
  markUnder18: () => kv.set(UNDER_18_KEY, '1'),
  isUnder18: async () => (await kv.get(UNDER_18_KEY)) === '1'
};
