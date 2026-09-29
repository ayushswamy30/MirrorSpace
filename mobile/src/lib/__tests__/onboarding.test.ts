import { consentCopy, CONSENT_POLICY_VERSION, onboardingPurposes } from '../consent';
import { onboardingPayload } from '../onboarding';

jest.mock('../supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('../db/kv', () => ({ kv: { get: jest.fn(), set: jest.fn(), remove: jest.fn() } }));

describe('onboardingPayload', () => {
  test('a skipped consent is sent as an explicit no, never left out', () => {
    const body = onboardingPayload({ intents: [], consents: {} });
    expect(body.consents).toEqual({ readings: false, ai_reflections: false });
  });

  test('carries the policy version the person actually saw', () => {
    const body = onboardingPayload({ intents: [], consents: { readings: true } });
    expect(body.policyVersion).toBe(CONSENT_POLICY_VERSION);
  });

  test('confirms age and the AI disclosure, which the screens before it required', () => {
    const body = onboardingPayload({ intents: ['sleep_better'], consents: {} });
    expect(body.ageConfirmed).toBe(true);
    expect(body.aiDisclosureSeen).toBe(true);
    expect(body.intents).toEqual(['sleep_better']);
  });

  test('the legacy chatReflections flag follows the AI consent', () => {
    expect(onboardingPayload({ intents: [], consents: { ai_reflections: true } }).permissions.chatReflections).toBe(true);
    expect(onboardingPayload({ intents: [], consents: { ai_reflections: false } }).permissions.chatReflections).toBe(false);
  });
});

describe('consent copy', () => {
  test.each(onboardingPurposes)('"%s" says what is sent, what never is, and what saying no means', purpose => {
    const copy = consentCopy[purpose];
    expect(copy.title).toMatch(/\?$/);
    expect(copy.sends.length).toBeGreaterThan(0);
    expect(copy.neverSends.length).toBeGreaterThan(0);
    expect(copy.declined.length).toBeGreaterThan(0);
  });

  test('uses none of the words the report rules out', () => {
    const banned = /\b(treat|therapy|therapist|diagnos\w*|depression|anxiety|clinical)\b/i;
    for (const copy of Object.values(consentCopy)) {
      for (const line of [copy.title, ...copy.sends, ...copy.neverSends, copy.declined]) {
        expect(line).not.toMatch(banned);
      }
    }
  });
});
