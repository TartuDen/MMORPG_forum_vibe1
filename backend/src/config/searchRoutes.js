import express from 'express';
import { searchThreads, searchComments, searchUsers, searchForums, searchSuggestions } from '../modules/search.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();
const MIN_QUERY_LENGTH = 4;

const getQueryError = (query) => {
  if (!query || query.trim().length === 0) {
    return { status: 400, error: 'Search query required', code: 'MISSING_QUERY' };
  }
  if (query.trim().length < MIN_QUERY_LENGTH) {
    return {
      status: 400,
      error: `Query must be at least ${MIN_QUERY_LENGTH} characters`,
      code: 'QUERY_TOO_SHORT'
    };
  }
  if (query.length > 500) {
    return { status: 400, error: 'Query too long', code: 'QUERY_TOO_LONG' };
  }
  return null;
};

// Search suggestions
router.get('/suggestions', cacheResponse(8000), async (req, res, next) => {
  try {
    const { q, limit = 8 } = req.query;
    const error = getQueryError(q);
    if (error) {
      return res.status(error.status).json({ error: error.error, code: error.code });
    }

    const safeLimit = Math.min(parseInt(limit) || 8, 20);
    const results = await searchSuggestions(q.trim(), safeLimit);
    res.status(200).json({
      data: results,
      message: 'Search suggestions'
    });
  } catch (error) {
    next(error);
  }
});

// Search threads
router.get('/threads', cacheResponse(15000), async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 10, 50);

    const error = getQueryError(q);
    if (error) {
      return res.status(error.status).json({ error: error.error, code: error.code });
    }

    const { results, pagination } = await searchThreads(
      q.trim(),
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

    const error = getQueryError(q);
    if (error) {
      return res.status(error.status).json({ error: error.error, code: error.code });
    }

    const { results, pagination } = await searchComments(
      q.trim(),
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

    const error = getQueryError(q);
    if (error) {
      return res.status(error.status).json({ error: error.error, code: error.code });
    }

    const { results, pagination } = await searchUsers(
      q.trim(),
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

    const error = getQueryError(q);
    if (error) {
      return res.status(error.status).json({ error: error.error, code: error.code });
    }

    const { results, pagination } = await searchForums(
      q.trim(),
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
