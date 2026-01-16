import express from 'express';
import { getAllForums, getForumById, createForum } from '../modules/forums.js';
import { getAllThreads, getThreadById, createThread, updateThread, deleteThread, incrementThreadViews } from '../modules/threads.js';
import { getThreadComments, createComment, updateComment, deleteComment } from '../modules/comments.js';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get all games
router.get('/games/all', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, description, icon_url FROM games ORDER BY name');
    res.status(200).json({
      data: result.rows,
      message: 'Games retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Create new forum
router.post('/create', authenticate, async (req, res, next) => {
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

// Get all forums or forums by game
router.get('/', async (req, res, next) => {
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
router.get('/:forumId', async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

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
router.get('/:forumId/threads/:threadId', async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

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
router.post('/:forumId/threads', authenticate, async (req, res, next) => {
  try {
    const { forumId } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify forum exists
    await getForumById(forumId);

    const thread = await createThread(forumId, req.userId, title, content);

    res.status(201).json({
      data: thread,
      message: 'Thread created'
    });
  } catch (error) {
    next(error);
  }
});

// Update thread
router.put('/:forumId/threads/:threadId', authenticate, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { title, content, is_locked, is_pinned } = req.body;

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
router.delete('/:forumId/threads/:threadId', authenticate, async (req, res, next) => {
  try {
    const { threadId } = req.params;

    await deleteThread(threadId, req.userId);

    res.status(200).json({
      message: 'Thread deleted'
    });
  } catch (error) {
    next(error);
  }
});

// Create comment
router.post('/:forumId/threads/:threadId/comments', authenticate, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        code: 'MISSING_FIELDS'
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
router.put('/:forumId/threads/:threadId/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        code: 'MISSING_FIELDS'
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
router.delete('/:forumId/threads/:threadId/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const { commentId } = req.params;

    await deleteComment(commentId, req.userId);

    res.status(200).json({
      message: 'Comment deleted'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
