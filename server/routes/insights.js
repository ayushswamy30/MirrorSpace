import express from 'express';
import auth from '../middleware/auth.js';
import * as insights from '../db/insights.js';
import { generateDailyInsight, generateWeeklyInsight } from '../services/insightGenerator.js';

const router = express.Router();

// GET /api/insights/today — Get today's insight
router.get('/today', auth, async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let insight = await insights.findLatestSince(req.userId, 'daily', startOfToday);

    if (!insight) {
      insight = await generateDailyInsight(req.userId);
    }

    if (insight && !insight.seen) {
      insight = await insights.markSeen(insight.id);
    }

    res.json(insight || {
      headline: 'Be still for a moment.',
      subtext: 'Not every day needs a reflection.'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/insights/weekly — Get weekly reflection
router.get('/weekly', auth, async (req, res, next) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let insight = await insights.findLatestSince(req.userId, 'weekly', weekAgo);

    if (!insight) {
      insight = await generateWeeklyInsight(req.userId);
    }

    res.json(insight || {
      headline: 'A week is just seven attempts at rest.',
      subtext: null
    });
  } catch (error) {
    next(error);
  }
});

export default router;
