import express from 'express';
import auth from '../middleware/auth.js';
import { accountLimiter } from '../middleware/rateLimit.js';
import * as users from '../db/users.js';
import * as account from '../db/account.js';

const router = express.Router();

// PUT /api/user/onboarding — Save onboarding choices
router.put('/onboarding', auth, async (req, res, next) => {
  try {
    const { intents, permissions } = req.body ?? {};

    const user = await users.saveOnboarding(req.userId, { intents, permissions });

    res.json({
      id: user.id,
      email: user.email,
      isAnonymous: user.isAnonymous,
      intents: user.intents,
      permissions: user.permissions,
      onboardingComplete: user.onboardingComplete
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/user/profile
router.get('/profile', auth, async (req, res, next) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      isAnonymous: req.user.isAnonymous,
      intents: req.user.intents,
      permissions: req.user.permissions,
      onboardingComplete: req.user.onboardingComplete,
      createdAt: req.user.createdAt
    });
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
        createdAt: req.user.createdAt
      },
      ...data
    };

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="mirrorspace-${stamp}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // An export of someone's journals should not sit in any shared cache.
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
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
