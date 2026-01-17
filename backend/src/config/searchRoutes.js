import express from 'express';
import { searchThreads, searchComments, searchUsers, searchForums } from '../modules/search.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

// Search threads
router.get('/threads', cacheResponse(15000), async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 10, 50);

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    if (q.length > 500) {
      return res.status(400).json({
        error: 'Query too long',
        code: 'QUERY_TOO_LONG'
      });
    }

    const { results, pagination } = await searchThreads(
      q,
      parseInt(page),
      safeLimit
    );

    res.status(200).json({
      data: results,
      pagination,
      message: 'Search results'
    });
  } catch (error) {
    next(error);
  }
});

// Search comments
router.get('/comments', cacheResponse(15000), async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 10, 50);

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    const { results, pagination } = await searchComments(
      q,
      parseInt(page),
      safeLimit
    );

    res.status(200).json({
      data: results,
      pagination,
      message: 'Search results'
    });
  } catch (error) {
    next(error);
  }
});

// Search users
router.get('/users', cacheResponse(15000), async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 10, 50);

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    const { results, pagination } = await searchUsers(
      q,
      parseInt(page),
      safeLimit
    );

    res.status(200).json({
      data: results,
      pagination,
      message: 'Search results'
    });
  } catch (error) {
    next(error);
  }
});

// Search forums
router.get('/forums', cacheResponse(15000), async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 10, 50);

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    const { results, pagination } = await searchForums(
      q,
      parseInt(page),
      safeLimit
    );

    res.status(200).json({
      data: results,
      pagination,
      message: 'Search results'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
