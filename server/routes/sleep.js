import express from 'express';
import auth from '../middleware/auth.js';
import * as sleepLogs from '../db/sleepLogs.js';

const router = express.Router();

const RANGE_DAYS = { week: 7, month: 30, year: 365, all: null };

function startOfRange(range) {
  const days = RANGE_DAYS[range];
  if (days === null || days === undefined) return null;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);
  return since;
}

// POST /api/sleep — Log sleep entry
router.post('/', auth, async (req, res, next) => {
  try {
    const { date, sleepTime, wakeTime } = req.body ?? {};

    const sleepDate = new Date(sleepTime);
    const wakeDate = new Date(wakeTime);
    const nightOf = new Date(date);

    if ([sleepDate, wakeDate, nightOf].some(d => Number.isNaN(d.getTime()))) {
      return res.status(400).json({ message: 'date, sleepTime and wakeTime must be valid dates' });
    }

    const duration = Math.round((wakeDate - sleepDate) / (1000 * 60)); // minutes

    if (duration <= 0) {
      return res.status(400).json({ message: 'wakeTime must be after sleepTime' });
    }

    if (duration > 24 * 60) {
      return res.status(400).json({ message: 'A single night cannot be longer than 24 hours' });
    }

    const log = await sleepLogs.upsert(req.userId, {
      date: nightOf.toISOString().slice(0, 10),
      sleepTime: sleepDate.toISOString(),
      wakeTime: wakeDate.toISOString(),
      duration
    });

    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

// GET /api/sleep?range=week|month|year|all — History for the sleep chart
router.get('/', auth, async (req, res, next) => {
  try {
    const range = String(req.query.range || 'week');

    if (!(range in RANGE_DAYS)) {
      return res.status(400).json({ message: `range must be one of: ${Object.keys(RANGE_DAYS).join(', ')}` });
    }

    // Ascending so the chart reads left-to-right, oldest first.
    const logs = await sleepLogs.listForUser(req.userId, startOfRange(range), 'asc');

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// GET /api/sleep/trends — Aggregates over a rolling window
router.get('/trends', auth, async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 365);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const logs = await sleepLogs.listForUser(req.userId, since, 'desc');

    const avgDuration = logs.length
      ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / logs.length)
      : 0;

    const sleepDebt = logs.filter(l => l.duration < 420).length; // nights under 7 hours

    // Irregularity: how much the bedtime itself drifts, in hours.
    let irregularity = 0;
    if (logs.length > 1) {
      const sleepHours = logs.map(l => {
        const t = new Date(l.sleepTime);
        return t.getHours() + t.getMinutes() / 60;
      });
      const avgHour = sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length;
      irregularity = Math.sqrt(
        sleepHours.reduce((sum, h) => sum + (h - avgHour) ** 2, 0) / sleepHours.length
      );
    }

    res.json({
      logs,
      trends: {
        avgDuration,
        sleepDebt,
        irregularity: Math.round(irregularity * 100) / 100,
        totalLogs: logs.length
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
