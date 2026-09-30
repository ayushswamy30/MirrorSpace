import express from 'express';

import * as circle from '../db/circle.js';
import * as consents from '../db/consents.js';
import {
  CircleValidationError,
  currentWeather,
  isLow,
  MAX_FRIENDS,
  normalizeCode,
  parseIcon,
  parseName,
  parseStatus,
  rhythmLine
} from '../lib/circle.js';
import auth from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { notify } from '../services/push.js';

/**
 * Circle (report §4–5): a few friends who see each other's Inner Weather and
 * a "running low" signal, and nothing else. Sharing needs the `circle`
 * consent; without it a person can still see and accept friends, but shows
 * nothing of their own.
 */
const router = express.Router();

/** One "thinking of you" per friend per hour: it's a gesture, not a stream. */
const NUDGE_GAP_MS = 60 * 60 * 1000;

const sharing = userId => consents.isGranted(userId, 'circle');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A malformed id can't name anything: answer 404 rather than let Postgres 500.
router.param('id', (req, res, next, id) => {
  if (!UUID.test(id)) return res.status(404).json({ message: 'Nothing lives at this address' });
  next();
});

function other(friendship, userId) {
  return friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
}

async function friendOf(userId, friendshipId) {
  const rows = await circle.friendships(userId);
  const found = rows.find(f => f.id === friendshipId && f.status === 'accepted');
  return found ? other(found, userId) : null;
}

function handle(res, next, error) {
  if (error instanceof CircleValidationError) return res.status(400).json({ message: error.message });
  next(error);
}

// GET /api/circle — me, friends with today's weather, requests, nudges
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const [profile, rows, nudges, shared] = await Promise.all([
      circle.me(userId),
      circle.friendships(userId),
      circle.unseenNudges(userId),
      sharing(userId)
    ]);

    const ids = [...new Set([...rows.map(f => other(f, userId)), ...nudges.map(n => n.from_user_id)])];
    const [names, icons, statuses] = await Promise.all([circle.names(ids), circle.icons(ids), circle.statuses([userId, ...ids])]);
    const mine = statuses.get(userId);
    const now = new Date();

    const friends = rows
      .filter(f => f.status === 'accepted')
      .map(f => {
        const id = other(f, userId);
        const name = names.get(id) ?? 'A friend';
        const s = statuses.get(id);
        return {
          id: f.id,
          name,
          icon: icons.get(id) ?? null,
          weather: s ? currentWeather(s.weather, s.weather_date, now) : null,
          low: s ? isLow(s.low_since, now) : false,
          rhythm: shared ? rhythmLine(mine?.rhythm, s?.rhythm, name) : null,
          since: f.accepted_at
        };
      })
      .sort((a, b) => Number(b.low) - Number(a.low) || a.name.localeCompare(b.name));

    const pending = rows.filter(f => f.status === 'pending');
    res.json({
      me: {
        name: profile.name,
        code: profile.code,
        icon: profile.icon ?? null,
        sharing: shared,
        low: mine ? isLow(mine.low_since, now) : false
      },
      friends,
      incoming: pending
        .filter(f => f.addressee_id === userId)
        .map(f => ({ id: f.id, name: names.get(f.requester_id) ?? 'Someone', icon: icons.get(f.requester_id) ?? null })),
      outgoing: pending.filter(f => f.requester_id === userId).map(f => ({ id: f.id, name: names.get(f.addressee_id) ?? 'Someone' })),
      nudges: nudges.map(n => ({ name: names.get(n.from_user_id) ?? 'A friend', at: n.created_at }))
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/circle/profile — { name, icon? }: what friends see; mints a code
router.put('/profile', auth, writeLimiter, async (req, res, next) => {
  try {
    const icon = req.body?.icon === undefined ? undefined : parseIcon(req.body.icon);
    res.json(await circle.setName(req.userId, parseName(req.body?.name), icon));
  } catch (error) {
    handle(res, next, error);
  }
});

// POST /api/circle/requests — { code }: ask to join someone's circle
router.post('/requests', auth, writeLimiter, async (req, res, next) => {
  try {
    const code = normalizeCode(req.body?.code);
    const [target, profile, rows] = await Promise.all([
      circle.findByCode(code),
      circle.me(req.userId),
      circle.friendships(req.userId)
    ]);

    if (!profile.name) return res.status(409).json({ message: 'Choose the name your circle sees first.', code: 'no_name' });
    if (!target) return res.status(404).json({ message: 'No one has that code.' });
    if (target.id === req.userId) return res.status(400).json({ message: 'That’s your own code.' });
    if (rows.length >= MAX_FRIENDS) {
      return res.status(422).json({ message: `A circle is small on purpose — ${MAX_FRIENDS} people at most.` });
    }

    const result = await circle.request(req.userId, target.id);
    if (result === 'exists') return res.status(409).json({ message: `You and ${target.name} are already connected, or waiting.` });
    notify([target.id], 'request');
    res.status(201).json({ name: target.name });
  } catch (error) {
    handle(res, next, error);
  }
});

// POST /api/circle/requests/:id/accept
router.post('/requests/:id/accept', auth, writeLimiter, async (req, res, next) => {
  try {
    const requester = await circle.accept(req.params.id, req.userId);
    if (!requester) return res.status(404).json({ message: 'That request is gone.' });
    notify([requester], 'accepted');
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// DELETE /api/circle/friends/:id — decline, cancel or remove; either side can
router.delete('/friends/:id', auth, writeLimiter, async (req, res, next) => {
  try {
    if (!(await circle.remove(req.params.id, req.userId))) return res.status(404).json({ message: 'Already gone.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// PUT /api/circle/status — { weather, date, rhythm }: the whole of what's shared
router.put('/status', auth, writeLimiter, async (req, res, next) => {
  try {
    const status = parseStatus(req.body);
    if (!(await sharing(req.userId))) return res.status(403).json({ message: 'Sharing with your circle is off', code: 'no_consent' });
    await circle.saveStatus(req.userId, status);
    res.status(204).end();
  } catch (error) {
    handle(res, next, error);
  }
});

// PUT /api/circle/low — { on }: "running low", no explanation needed
router.put('/low', auth, writeLimiter, async (req, res, next) => {
  try {
    if (typeof req.body?.on !== 'boolean') return res.status(400).json({ message: 'on must be true or false' });
    if (!(await sharing(req.userId))) return res.status(403).json({ message: 'Sharing with your circle is off', code: 'no_consent' });
    await circle.setLow(req.userId, req.body.on);
    // Only turning it on reaches anyone: feeling better needs no alert.
    if (req.body.on) {
      const rows = await circle.friendships(req.userId);
      notify(rows.filter(f => f.status === 'accepted').map(f => other(f, req.userId)), 'low');
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// POST /api/circle/friends/:id/nudge — "thinking of you"
router.post('/friends/:id/nudge', auth, writeLimiter, async (req, res, next) => {
  try {
    const friendId = await friendOf(req.userId, req.params.id);
    if (!friendId) return res.status(404).json({ message: 'Not in your circle.' });

    const last = await circle.lastNudge(req.userId, friendId);
    if (last && Date.now() - new Date(last).getTime() < NUDGE_GAP_MS) {
      return res.status(429).json({ message: 'Sent already — they’ll see it.' });
    }
    await circle.nudge(req.userId, friendId);
    notify([friendId], 'nudge');
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// POST /api/circle/nudges/seen
router.post('/nudges/seen', auth, writeLimiter, async (req, res, next) => {
  try {
    await circle.markNudgesSeen(req.userId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
