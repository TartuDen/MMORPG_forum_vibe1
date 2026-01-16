import express from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, username, email, role, profile_picture_url, bio, total_posts, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.status(200).json({
      data: result.rows[0],
      message: 'User retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Get all users (paginated)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT id, username, email, role, profile_picture_url, bio, total_posts, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const total = parseInt(countResult.rows[0].total);

    res.status(200).json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Users retrieved'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
