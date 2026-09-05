import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import * as users from '../db/users.js';

const router = express.Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/auth/init — Initialize anonymous user (local-first)
router.post('/init', async (req, res, next) => {
  try {
    const { localId } = req.body ?? {};

    // A client-supplied localId is an identity claim, so only accept the UUID
    // shape the app generates. Anything else gets a fresh one.
    const id = typeof localId === 'string' && UUID_PATTERN.test(localId) ? localId : randomUUID();

    const user = await users.findOrCreateByLocalId(id);

    const token = jwt.sign(
      { userId: user.id, localId: user.localId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        localId: user.localId,
        onboardingComplete: user.onboardingComplete,
        intents: user.intents,
        permissions: user.permissions
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
