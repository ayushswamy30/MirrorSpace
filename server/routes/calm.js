import express from 'express';
import auth from '../middleware/auth.js';
import * as calmTriggers from '../db/calmTriggers.js';

const router = express.Router();

// POST /api/calm/trigger — Log calm mode trigger
router.post('/trigger', auth, async (req, res, next) => {
  try {
    const { source = 'manual' } = req.body ?? {};

    // Persisted now — the old handler said it logged this but stored nothing,
    // so the pattern engine had no record of panic moments to read.
    const trigger = await calmTriggers.record(req.userId, source);

    res.json({
      activated: true,
      message: 'Breathe.',
      source: trigger.source
    });
  } catch (error) {
    next(error);
  }
});

export default router;
