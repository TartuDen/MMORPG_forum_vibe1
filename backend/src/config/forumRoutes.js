import express from 'express';
import { getAllForums, getForumById, createForum, createGame, updateGame, deleteForum, deleteGame } from '../modules/forums.js';
import { getAllThreads, getThreadById, createThread, updateThread, deleteThread, incrementThreadViews } from '../modules/threads.js';
import { getThreadComments, createComment, updateComment, deleteComment } from '../modules/comments.js';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../db/connection.js';
import { parseImageDataUrl } from '../utils/validators.js';
import { cacheResponse } from '../middleware/cache.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const MAX_THREAD_TITLE_LENGTH = 200;
const MAX_THREAD_CONTENT_LENGTH = 5000;
const MAX_COMMENT_LENGTH = 2000;

// Get all games
router.get('/games/all', cacheResponse(60000), async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, description, tags, icon_url, website_url FROM games ORDER BY name');
    res.status(200).json({
      data: result.rows,
      message: 'Games retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Create new forum
router.post('/create', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
  try {
    const { gameId, name, description } = req.body;

    if (!gameId || !name || !description) {
      return res.status(400).json({
        error: 'Game ID, name, and description are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (name.length < 3 || name.length > 100) {
      return res.status(400).json({
        error: 'Forum name must be between 3 and 100 characters',
        code: 'INVALID_NAME'
      });
    }

    if (description.length < 10 || description.length > 500) {
      return res.status(400).json({
        error: 'Forum description must be between 10 and 500 characters',
        code: 'INVALID_DESCRIPTION'
      });
    }

    // Verify game exists
    const gameCheck = await pool.query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Game not found',
        code: 'GAME_NOT_FOUND'
      });
    }

    const forum = await createForum(gameId, name, description);

    res.status(201).json({
      data: forum,
      message: 'Forum created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Create new game (admin only)
router.post('/games', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
  try {
    const { name, description = '', tags, icon_url = null, website_url = null } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        error: 'Game name is required',
        code: 'MISSING_FIELDS'
      });
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        error: 'At least one tag is required',
        code: 'MISSING_TAGS'
      });
    }

    const game = await createGame(name.trim(), description, tags, icon_url, website_url);

    res.status(201).json({
      data: game,
      message: 'Game created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Update game (admin only)
router.put('/games/:gameId', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const gameIdValue = parseInt(gameId, 10);
    if (Number.isNaN(gameIdValue)) {
      return res.status(400).json({
        error: 'Invalid game id',
        code: 'INVALID_GAME_ID'
      });
    }

    const { name, description, tags, icon_url, website_url } = req.body;
    const updated = await updateGame(gameIdValue, { name, description, tags, icon_url, website_url });

    res.status(200).json({
      data: updated,
      message: 'Game updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete game (admin only)
router.delete('/games/:gameId', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const gameIdValue = parseInt(gameId, 10);
    if (Number.isNaN(gameIdValue)) {
      return res.status(400).json({
        error: 'Invalid game id',
        code: 'INVALID_GAME_ID'
      });
    }

    await deleteGame(gameIdValue);
    res.status(200).json({ message: 'Game deleted' });
  } catch (error) {
    next(error);
  }
});

// Delete forum (admin only)
router.delete('/:forumId', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const forumIdValue = parseInt(forumId, 10);
    if (Number.isNaN(forumIdValue)) {
      return res.status(400).json({
        error: 'Invalid forum id',
        code: 'INVALID_FORUM_ID'
      });
    }

    await deleteForum(forumIdValue);
    res.status(200).json({ message: 'Forum deleted' });
  } catch (error) {
    next(error);
  }
});

// Get all forums or forums by game
router.get('/', cacheResponse(30000), async (req, res, next) => {
  try {
    const gameId = req.query.gameId ? parseInt(req.query.gameId) : null;
    const forums = await getAllForums(gameId);
    res.status(200).json({
      data: forums,
      message: 'Forums retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Get forum by ID with threads
router.get('/:forumId', cacheResponse(15000), async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const forum = await getForumById(forumId);
    const { threads, pagination } = await getAllThreads(forumId, page, limit);

    res.status(200).json({
      data: {
        ...forum,
        threads
      },
      pagination,
      message: 'Forum retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Get thread by ID with comments
router.get('/:forumId/threads/:threadId', cacheResponse(15000), async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const thread = await getThreadById(threadId);
    await incrementThreadViews(threadId);

    const { comments, pagination } = await getThreadComments(threadId, page, limit);

    res.status(200).json({
      data: {
        ...thread,
        comments
      },
      pagination,
      message: 'Thread retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Create thread
router.post('/:forumId/threads', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const { title, content, image_url } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (title.length > MAX_THREAD_TITLE_LENGTH) {
      return res.status(400).json({
        error: `Title must be ${MAX_THREAD_TITLE_LENGTH} characters or less`,
        code: 'TITLE_TOO_LONG'
      });
    }

    if (content.length > MAX_THREAD_CONTENT_LENGTH) {
      return res.status(400).json({
        error: `Content must be ${MAX_THREAD_CONTENT_LENGTH} characters or less`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    // Verify forum exists
    await getForumById(forumId);

    if (image_url) {
      parseImageDataUrl(image_url, 300 * 1024);
    }

    const thread = await createThread(forumId, req.userId, title, content, image_url || null);

    res.status(201).json({
      data: thread,
      message: 'Thread created'
    });
  } catch (error) {
    next(error);
  }
});

// Update thread
router.put('/:forumId/threads/:threadId', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { title, content, is_locked, is_pinned } = req.body;

    if (title && title.length > MAX_THREAD_TITLE_LENGTH) {
      return res.status(400).json({
        error: `Title must be ${MAX_THREAD_TITLE_LENGTH} characters or less`,
        code: 'TITLE_TOO_LONG'
      });
    }

    if (content && content.length > MAX_THREAD_CONTENT_LENGTH) {
      return res.status(400).json({
        error: `Content must be ${MAX_THREAD_CONTENT_LENGTH} characters or less`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    const thread = await updateThread(threadId, req.userId, {
      title,
      content,
      is_locked,
      is_pinned
    });

    res.status(200).json({
      data: thread,
      message: 'Thread updated'
    });
  } catch (error) {
    next(error);
  }
});

// Delete thread
router.delete('/:forumId/threads/:threadId', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { threadId } = req.params;

    await deleteThread(threadId, req.userId, req.userRole);

    res.status(200).json({
      message: 'Thread deleted'
    });
  } catch (error) {
    next(error);
  }
});

// Create comment
router.post('/:forumId/threads/:threadId/comments', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        code: 'MISSING_FIELDS'
      });
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        error: `Content must be ${MAX_COMMENT_LENGTH} characters or less`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    const comment = await createComment(threadId, req.userId, content);

    res.status(201).json({
      data: comment,
      message: 'Comment created'
    });
  } catch (error) {
    next(error);
  }
});

// Update comment
router.put('/:forumId/threads/:threadId/comments/:commentId', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        code: 'MISSING_FIELDS'
      });
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        error: `Content must be ${MAX_COMMENT_LENGTH} characters or less`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    const comment = await updateComment(commentId, req.userId, content);

    res.status(200).json({
      data: comment,
      message: 'Comment updated'
    });
  } catch (error) {
    next(error);
  }
});

// Delete comment
router.delete('/:forumId/threads/:threadId/comments/:commentId', authenticate, writeLimiter, async (req, res, next) => {
  try {
    const { commentId } = req.params;

    await deleteComment(commentId, req.userId, req.userRole);

    res.status(200).json({
      message: 'Comment deleted'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
