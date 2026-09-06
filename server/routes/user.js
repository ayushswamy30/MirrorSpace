import express from 'express';
import auth from '../middleware/auth.js';
import * as users from '../db/users.js';

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

export default router;
