import express from 'express';
import auth from '../middleware/auth.js';
import * as journalEntries from '../db/journalEntries.js';
import { analyzeText } from '../services/patternEngine.js';

const router = express.Router();

const MAX_CONTENT_LENGTH = 20000;
const VALID_TYPES = ['text', 'chaos'];

// POST /api/journal — Create journal/vent entry
router.post('/', auth, async (req, res, next) => {
  try {
    const { content, type = 'text' } = req.body ?? {};

    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(413).json({ message: 'That entry is longer than we can hold' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    // Analysis runs silently — the user never sees it come back.
    const analysis = analyzeText(content);

    const entry = await journalEntries.create(req.userId, {
      type,
      content,
      sentiment: analysis.sentiment,
      patterns: analysis.patterns
    });

    res.status(201).json({
      id: entry.id,
      type: entry.type,
      createdAt: entry.createdAt
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/journal — Get journal entries
router.get('/', auth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const { entries, total } = await journalEntries.listForUser(req.userId, {
      limit,
      offset: (page - 1) * limit
    });

    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

export default router;
