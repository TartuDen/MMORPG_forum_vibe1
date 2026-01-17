import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  createOrGetConversation,
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  getOtherParticipantId
} from '../modules/messages.js';

const router = express.Router();
const MAX_MESSAGE_LENGTH = 2000;

router.use(authenticate);

// List conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await listConversations(req.userId);
    res.status(200).json({ data: conversations, message: 'Conversations retrieved' });
  } catch (error) {
    next(error);
  }
});

// Create or fetch conversation
router.post('/conversations', writeLimiter, async (req, res, next) => {
  try {
    const { userId } = req.body;
    const otherUserId = parseInt(userId, 10);
    if (!otherUserId) {
      return res.status(400).json({ error: 'User id is required', code: 'MISSING_USER_ID' });
    }
    const conversationId = await createOrGetConversation(req.userId, otherUserId);
    res.status(201).json({ data: { conversationId }, message: 'Conversation ready' });
  } catch (error) {
    next(error);
  }
});

// List messages
router.get('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const result = await listMessages(parseInt(conversationId, 10), req.userId, page, limit);
    res.status(200).json({ data: result.messages, pagination: result.pagination, message: 'Messages retrieved' });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/conversations/:conversationId/messages', writeLimiter, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required', code: 'MISSING_BODY' });
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less`, code: 'BODY_TOO_LONG' });
    }

    const message = await sendMessage(parseInt(conversationId, 10), req.userId, body.trim());

    const io = req.app.get('io');
    if (io) {
      const otherUserId = await getOtherParticipantId(parseInt(conversationId, 10), req.userId);
      if (otherUserId) {
        io.to(`user:${otherUserId}`).emit('dm:new', message);
      }
      io.to(`user:${req.userId}`).emit('dm:new', message);
    }

    res.status(201).json({ data: message, message: 'Message sent' });
  } catch (error) {
    next(error);
  }
});

// Mark conversation as read
router.post('/conversations/:conversationId/read', writeLimiter, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await markConversationRead(parseInt(conversationId, 10), req.userId);
    res.status(200).json({ data: result, message: 'Conversation marked read' });
  } catch (error) {
    next(error);
  }
});

export default router;
