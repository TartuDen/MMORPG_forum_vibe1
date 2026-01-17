import express from 'express';
import pool from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { banUser, unbanUser, updateUserRole } from '../modules/users.js';

const router = express.Router();

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, username, role, profile_picture_url, bio, total_posts, created_at FROM users WHERE id = $1',
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
      'SELECT id, username, role, profile_picture_url, bio, total_posts, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
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

// Ban user (admin only)
router.post('/:id/ban', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const userId = parseInt(id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    }

    const result = await banUser(userId, req.userId, reason || null);
    res.status(200).json({
      data: result,
      message: 'User banned'
    });
  } catch (error) {
    next(error);
  }
});

// Unban user (admin only)
router.post('/:id/unban', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const userId = parseInt(id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    }

    const result = await unbanUser(userId, req.userId, reason || null);
    res.status(200).json({
      data: result,
      message: 'User unbanned'
    });
  } catch (error) {
    next(error);
  }
});

// Update user role (admin only)
router.put('/:id/role', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    }
    if (!role) {
      return res.status(400).json({ error: 'Role is required', code: 'MISSING_ROLE' });
    }

    const updated = await updateUserRole(userId, role, req.userId);
    res.status(200).json({ data: updated, message: 'User role updated' });
  } catch (error) {
    next(error);
  }
});

export default router;
