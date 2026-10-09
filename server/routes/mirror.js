import express from 'express';

import * as consents from '../db/consents.js';
import { memoryLines, MirrorValidationError, parseMemory, parsePage, parseTurns } from '../lib/mirror.js';
import auth from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimit.js';
import { canReflectOnPersonalText, generateText } from '../services/ai.js';
import {
  CHATBOT_PROMPT,
  MIRROR_MEMORY_PROMPT,
  MIRROR_ROOM_PROMPT,
  PERSONALITY_PROMPT,
  VENT_REFLECTION_PROMPT
} from '../prompts/personality.js';

const router = express.Router();

async function reflectionsAllowed(userId) {
  const current = await consents.current(userId);
  return current?.ai_reflections?.granted === true;
}

// GET /api/mirror/status — can Mirror answer this person right now?
router.get('/status', auth, async (req, res, next) => {
  try {
    res.json({
      consented: await reflectionsAllowed(req.userId),
      available: canReflectOnPersonalText()
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/mirror/reply — answer the last turn; nothing is stored.
// { messages, memory? } — memory only when the person switched it on.
router.post('/reply', auth, chatLimiter, async (req, res, next) => {
  try {
    const turns = parseTurns(req.body?.messages);
    const memory = parseMemory(req.body?.memory);

    if (!(await reflectionsAllowed(req.userId))) {
      return res.status(403).json({ message: 'AI reflections are turned off', code: 'no_consent' });
    }
    if (!canReflectOnPersonalText()) {
      return res.status(503).json({ message: 'Reflections are not switched on yet', code: 'unavailable' });
    }

    const conversation = turns.map(t => `${t.role === 'user' ? 'User' : 'Mirror'}: ${t.content}`).join('\n');
    const reply = await generateText({
      // The room knows only the conversation — and, if the person chose,
      // the items on "What the Mirror knows", which it must cite.
      system: memory
        ? `${PERSONALITY_PROMPT}\n\n${CHATBOT_PROMPT}\n\n${MIRROR_MEMORY_PROMPT}\n\nItems:\n${memoryLines(memory)}`
        : `${PERSONALITY_PROMPT}\n\n${CHATBOT_PROMPT}\n\n${MIRROR_ROOM_PROMPT}`,
      prompt: `Conversation so far:\n${conversation}\n\nRespond as Mirror:`,
      personal: true
    });

    // No canned stand-in: a line that pretends to have read the message
    // would be a lie. The phone says Mirror couldn't answer.
    if (!reply) return res.status(503).json({ message: 'Mirror could not answer just now', code: 'no_reply' });

    res.json({ reply });
  } catch (error) {
    if (error instanceof MirrorValidationError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

// POST /api/mirror/reflect — { text }: a quiet observation on one vent page.
// The phone shows it hours later. Stateless like the room: nothing is kept.
router.post('/reflect', auth, chatLimiter, async (req, res, next) => {
  try {
    const text = parsePage(req.body);

    if (!(await reflectionsAllowed(req.userId))) {
      return res.status(403).json({ message: 'AI reflections are turned off', code: 'no_consent' });
    }
    if (!canReflectOnPersonalText()) {
      return res.status(503).json({ message: 'Reflections are not switched on yet', code: 'unavailable' });
    }

    const reflection = await generateText({
      system: `${PERSONALITY_PROMPT}

${VENT_REFLECTION_PROMPT}

You see only this one page — no history, no patterns from other days. Never claim to know anything beyond it.`,
      prompt: `The page:
${text}

The reflection:`,
      personal: true,
      maxTokens: 300
    });

    if (!reflection) return res.status(503).json({ message: 'No reflection just now', code: 'no_reply' });
    res.json({ reflection });
  } catch (error) {
    if (error instanceof MirrorValidationError) return res.status(400).json({ message: error.message });
    next(error);
  }
});

export default router;
