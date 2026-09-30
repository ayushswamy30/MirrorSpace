/**
 * Consent purposes and their validation — kept free of database imports so it
 * can be unit tested on its own.
 *
 * Each purpose is asked for on its own screen and can be withdrawn as easily
 * as it was given. The current state of a purpose is its latest event.
 */

export const CONSENT_PURPOSES = ['readings', 'ai_reflections', 'health', 'circle'];

const MAX_POLICY_VERSION_LENGTH = 40;

export class ConsentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConsentValidationError';
  }
}

/**
 * Accepts `{ [purpose]: boolean }` plus the policy version the person saw.
 * Unknown purposes and non-boolean values are rejected rather than dropped: a
 * consent record that silently loses part of what was asked is worse than an
 * error.
 *
 * @returns {{ purpose: string, granted: boolean, policyVersion: string }[]}
 */
export function parseConsentChanges(consents, policyVersion) {
  if (consents === undefined || consents === null) return [];

  if (typeof consents !== 'object' || Array.isArray(consents)) {
    throw new ConsentValidationError('consents must be an object of purpose: boolean');
  }

  const entries = Object.entries(consents);
  if (entries.length === 0) return [];

  if (typeof policyVersion !== 'string' || policyVersion.trim().length === 0) {
    throw new ConsentValidationError('policyVersion is required with consents');
  }

  if (policyVersion.length > MAX_POLICY_VERSION_LENGTH) {
    throw new ConsentValidationError('policyVersion is too long');
  }

  return entries.map(([purpose, granted]) => {
    if (!CONSENT_PURPOSES.includes(purpose)) {
      throw new ConsentValidationError(`Unknown consent purpose: ${purpose}`);
    }
    if (typeof granted !== 'boolean') {
      throw new ConsentValidationError(`Consent for ${purpose} must be true or false`);
    }
    return { purpose, granted, policyVersion: policyVersion.trim() };
  });
}

/**
 * Collapse an event log (any order) into the current state per purpose.
 * A purpose with no events is `false`: nothing is assumed.
 */
export function currentConsents(events) {
  const latest = new Map();

  for (const event of events) {
    const seen = latest.get(event.purpose);
    if (!seen || new Date(event.createdAt) > new Date(seen.createdAt)) {
      latest.set(event.purpose, event);
    }
  }

  return Object.fromEntries(
    CONSENT_PURPOSES.map(purpose => {
      const event = latest.get(purpose);
      return [purpose, {
        granted: event?.granted ?? false,
        at: event?.createdAt ?? null,
        policyVersion: event?.policyVersion ?? null
      }];
    })
  );
}
