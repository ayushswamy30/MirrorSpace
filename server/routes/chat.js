import express from 'express';
import auth from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimit.js';
import * as chat from '../db/chat.js';
import { generateChatResponse } from '../services/reflectionEngine.js';
import { getUserContext } from '../services/patternEngine.js';

const router = express.Router();

const MAX_MESSAGE_LENGTH = 4000;
// Only the tail of a conversation is sent to the model — enough for continuity
// without an unbounded prompt on a long session.
const CONTEXT_WINDOW = 20;

// POST /api/chat/message — Send message to reflective chatbot
router.post('/message', auth, chatLimiter, async (req, res, next) => {
  try {
    const { message, sessionId } = req.body ?? {};

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(413).json({ message: 'That message is longer than we can hold' });
    }

    // findSession is scoped to the caller, so an id from another user reads
    // as "not found" and starts a fresh session rather than leaking theirs.
    let session = sessionId ? await chat.findSession(sessionId, req.userId) : null;

    if (!session) {
      const context = await getUserContext(req.userId);
      session = await chat.createSession(req.userId, context);
    }

    const userMessage = { role: 'user', content: message.trim() };
    const history = [...session.messages, userMessage].slice(-CONTEXT_WINDOW);

    const response = await generateChatResponse(history, session.context);

    await chat.appendMessages(session.id, [
      userMessage,
      { role: 'mirror', content: response }
    ]);

    res.json({
      sessionId: session.id,
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/chat/history — Get chat history
router.get('/history', auth, async (req, res, next) => {
  try {
    const sessions = await chat.listHistory(req.userId, 10);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

export default router;
