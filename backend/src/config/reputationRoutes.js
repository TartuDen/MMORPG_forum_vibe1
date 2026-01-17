import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  ensureVotingAllowed,
  getReputationSettings,
  updateReputationSettings,
  voteOnThread,
  voteOnComment
} from '../modules/reputation.js';

const router = express.Router();

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getReputationSettings();
    res.status(200).json({ data: settings, message: 'Reputation settings retrieved' });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
  try {
    const { min_account_age_days } = req.body;
    const minDays = Number.parseInt(min_account_age_days, 10);

    if (Number.isNaN(minDays) || minDays < 0 || minDays > 3650) {
      return res.status(400).json({
        error: 'min_account_age_days must be a number between 0 and 3650',
        code: 'INVALID_MIN_ACCOUNT_AGE'
      });
    }

    const settings = await updateReputationSettings(minDays);
    res.status(200).json({ data: settings, message: 'Reputation settings updated' });
  } catch (error) {
    next(error);
  }
});

router.post('/threads/:threadId/vote', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const threadIdValue = parseInt(threadId, 10);
    if (Number.isNaN(threadIdValue)) {
      return res.status(400).json({ error: 'Invalid thread id', code: 'INVALID_THREAD_ID' });
    }

    const { value } = req.body;
    const voteValue = Number.parseInt(value, 10);
    if (![1, 0, -1].includes(voteValue)) {
      return res.status(400).json({ error: 'Vote value must be -1, 0, or 1', code: 'INVALID_VOTE_VALUE' });
    }

    await ensureVotingAllowed(req.userId);
    const result = await voteOnThread(threadIdValue, req.userId, voteValue);

    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${threadIdValue}`).emit('reputation:thread_vote', {
        thread_id: threadIdValue,
        score: result.score
      });
    }

    res.status(200).json({ data: result, message: 'Thread vote recorded' });
  } catch (error) {
    next(error);
  }
});

router.post('/comments/:commentId/vote', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const commentIdValue = parseInt(commentId, 10);
    if (Number.isNaN(commentIdValue)) {
      return res.status(400).json({ error: 'Invalid comment id', code: 'INVALID_COMMENT_ID' });
    }

    const { value } = req.body;
    const voteValue = Number.parseInt(value, 10);
    if (![1, 0, -1].includes(voteValue)) {
      return res.status(400).json({ error: 'Vote value must be -1, 0, or 1', code: 'INVALID_VOTE_VALUE' });
    }

    await ensureVotingAllowed(req.userId);
    const result = await voteOnComment(commentIdValue, req.userId, voteValue);

    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${result.thread_id}`).emit('reputation:comment_vote', {
        thread_id: result.thread_id,
        comment_id: result.comment_id,
        score: result.score
      });
    }

    res.status(200).json({ data: result, message: 'Comment vote recorded' });
  } catch (error) {
    next(error);
  }
});

export default router;
