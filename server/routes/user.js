import express from 'express';
import auth from '../middleware/auth.js';
import { accountLimiter, writeLimiter } from '../middleware/rateLimit.js';
import * as users from '../db/users.js';
import * as account from '../db/account.js';
import * as consents from '../db/consents.js';
import * as circle from '../db/circle.js';
import * as push from '../db/push.js';
import { parseRegistration, PushValidationError } from '../lib/push.js';
import { parseConsentChanges, ConsentValidationError } from '../lib/consent.js';

const router = express.Router();

function toProfile(user, consentState) {
  return {
    id: user.id,
    email: user.email,
    isAnonymous: user.isAnonymous,
    intents: user.intents,
    permissions: user.permissions,
    onboardingComplete: user.onboardingComplete,
    ageConfirmedAt: user.ageConfirmedAt,
    aiDisclosureSeenAt: user.aiDisclosureSeenAt,
    consents: consentState,
    createdAt: user.createdAt
  };
}

// PUT /api/user/onboarding — Save onboarding choices
//
// Body: { intents, permissions, ageConfirmed?, aiDisclosureSeen?,
//         consents?: { [purpose]: boolean }, policyVersion? }
router.put('/onboarding', auth, async (req, res, next) => {
  try {
    const { intents, permissions, ageConfirmed, aiDisclosureSeen, consents: requested, policyVersion } = req.body ?? {};

    // Validate before writing anything, so a bad consent payload cannot leave
    // onboarding half-saved.
    const changes = parseConsentChanges(requested, policyVersion);

    const user = await users.saveOnboarding(req.user, { intents, permissions, ageConfirmed, aiDisclosureSeen });
    await consents.record(user.id, changes);

    res.json(toProfile(user, await consents.current(user.id)));
  } catch (error) {
    if (error instanceof ConsentValidationError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

// PUT /api/user/consents — grant or withdraw, one purpose or several
//
// Withdrawing has to be as easy as granting, and it is the same call.
router.put('/consents', auth, writeLimiter, async (req, res, next) => {
  try {
    const { consents: requested, policyVersion } = req.body ?? {};
    const changes = parseConsentChanges(requested, policyVersion);

    if (changes.length === 0) {
      return res.status(400).json({ message: 'consents must name at least one purpose' });
    }

    await consents.record(req.userId, changes);
    // Withdrawing the circle consent takes down what was shared, at once.
    if (changes.some(c => c.purpose === 'circle' && !c.granted)) await circle.clearStatus(req.userId);
    res.json({ consents: await consents.current(req.userId) });
  } catch (error) {
    if (error instanceof ConsentValidationError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

// GET /api/user/profile
router.get('/profile', auth, async (req, res, next) => {
  try {
    res.json(toProfile(req.user, await consents.current(req.userId)));
  } catch (error) {
    next(error);
  }
});

// GET /api/user/export — everything this account holds, as JSON
router.get('/export', auth, accountLimiter, async (req, res, next) => {
  try {
    const data = await account.collectAllData(req.userId);

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: req.user.id,
        email: req.user.email,
        isAnonymous: req.user.isAnonymous,
        intents: req.user.intents,
        permissions: req.user.permissions,
        onboardingComplete: req.user.onboardingComplete,
        ageConfirmedAt: req.user.ageConfirmedAt,
        aiDisclosureSeenAt: req.user.aiDisclosureSeenAt,
        createdAt: req.user.createdAt
      },
      ...data
    };

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="lowkei-${stamp}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // An export of someone's journals should not sit in any shared cache.
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// PUT /api/user/push-token — { token, platform }: where Circle alerts go
router.put('/push-token', auth, writeLimiter, async (req, res, next) => {
  try {
    await push.save(req.userId, parseRegistration(req.body));
    res.status(204).end();
  } catch (error) {
    if (error instanceof PushValidationError) return res.status(400).json({ message: error.message });
    next(error);
  }
});

// DELETE /api/user/push-token — { token }: this phone stops getting alerts
router.delete('/push-token', auth, writeLimiter, async (req, res, next) => {
  try {
    if (typeof req.body?.token !== 'string') return res.status(400).json({ message: 'token is required' });
    await push.remove(req.userId, req.body.token);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// DELETE /api/user — erase the account and everything attached to it
router.delete('/', auth, accountLimiter, async (req, res, next) => {
  try {
    // Deleting the auth identity cascades through public.users to every row.
    await account.eraseAccount(req.authUserId);

    res.status(200).json({
      deleted: true,
      message: 'Your space is gone. Nothing was kept.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
