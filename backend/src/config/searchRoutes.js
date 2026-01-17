import express from 'express';
import { searchThreads, searchComments, searchUsers, searchForums } from '../modules/search.js';

const router = express.Router();

// Search threads
router.get('/threads', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

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
      parseInt(limit)
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
router.get('/comments', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    const { results, pagination } = await searchComments(
      q,
      parseInt(page),
      parseInt(limit)
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
router.get('/users', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    const { results, pagination } = await searchUsers(
      q,
      parseInt(page),
      parseInt(limit)
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
router.get('/forums', async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query required',
        code: 'MISSING_QUERY'
      });
    }

    const { results, pagination } = await searchForums(
      q,
      parseInt(page),
      parseInt(limit)
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
