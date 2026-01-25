import express from 'express';
import pool from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { banUser, unbanUser, updateUserRole, getUserReputation } from '../modules/users.js';
import { cacheResponse } from '../middleware/cache.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Admin user overview (paginated)
router.get('/admin/overview', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `
        WITH user_activity AS (
          SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.total_posts,
            u.is_email_verified,
            u.is_banned,
            u.created_at,
            (SELECT COUNT(*) FROM threads t WHERE t.user_id = u.id) AS thread_count,
            (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.is_deleted = false) AS comment_count,
            (SELECT MAX(created_at) FROM threads t WHERE t.user_id = u.id) AS last_thread_at,
            (SELECT MAX(created_at) FROM comments c WHERE c.user_id = u.id) AS last_comment_at
          FROM users u
        )
        SELECT
          id,
          username,
          email,
          role,
          total_posts,
          is_email_verified,
          is_banned,
          created_at,
          thread_count,
          comment_count,
          CASE
            WHEN last_thread_at IS NULL AND last_comment_at IS NULL THEN NULL
            WHEN last_thread_at IS NULL THEN last_comment_at
            WHEN last_comment_at IS NULL THEN last_thread_at
            ELSE GREATEST(last_thread_at, last_comment_at)
          END AS last_activity_at
        FROM user_activity
        ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Admin user overview retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Admin user threads (paginated)
router.get('/admin/:id/threads', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `
        SELECT
          t.id,
          t.forum_id,
          t.user_id,
          t.title,
          t.content,
          t.created_at,
          t.comment_count,
          t.view_count,
          t.is_locked,
          t.is_pinned,
          f.name AS forum_name,
          g.name AS game_name
        FROM threads t
        JOIN forums f ON t.forum_id = f.id
        JOIN games g ON f.game_id = g.id
        WHERE t.user_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM threads WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Admin user threads retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Admin user posts (threads + comments) (paginated)
router.get('/admin/:id/posts', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;
    const threadPageSize = Math.min(parseInt(req.query.threadPageSize, 10) || 10, 50);

    const result = await pool.query(
      `
        WITH thread_posts AS (
          SELECT
            'thread'::text AS post_type,
            t.id AS thread_id,
            t.forum_id,
            t.title AS thread_title,
            t.content AS content,
            t.created_at,
            t.comment_count,
            t.view_count,
            f.name AS forum_name,
            g.name AS game_name,
            NULL::int AS comment_id,
            NULL::int AS reply_count,
            NULL::int AS thread_page
          FROM threads t
          JOIN forums f ON t.forum_id = f.id
          JOIN games g ON f.game_id = g.id
          WHERE t.user_id = $1
        ),
        comment_posts AS (
          SELECT
            'comment'::text AS post_type,
            c.thread_id,
            t.forum_id,
            t.title AS thread_title,
            c.content AS content,
            c.created_at,
            t.comment_count,
            NULL::int AS view_count,
            f.name AS forum_name,
            g.name AS game_name,
            c.id AS comment_id,
            (
              SELECT COUNT(*)
              FROM comments cr
              WHERE cr.parent_comment_id = c.id AND cr.is_deleted = false
            ) AS reply_count,
            CEIL(
              ROW_NUMBER() OVER (PARTITION BY c.thread_id ORDER BY c.created_at ASC)
              / $4::numeric
            ) AS thread_page
          FROM comments c
          JOIN threads t ON c.thread_id = t.id
          JOIN forums f ON t.forum_id = f.id
          JOIN games g ON f.game_id = g.id
          WHERE c.user_id = $1 AND c.is_deleted = false
        )
        SELECT *
        FROM (
          SELECT * FROM thread_posts
          UNION ALL
          SELECT * FROM comment_posts
        ) combined
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset, threadPageSize]
    );

    const countResult = await pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM threads WHERE user_id = $1) +
          (SELECT COUNT(*) FROM comments WHERE user_id = $1 AND is_deleted = false)
          AS total
      `,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Admin user posts retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Admin user comments (paginated)
router.get('/admin/:id/comments', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id', code: 'INVALID_USER_ID' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;
    const threadPageSize = Math.min(parseInt(req.query.threadPageSize, 10) || 10, 50);

    const result = await pool.query(
      `
        WITH ordered_comments AS (
          SELECT
            c.id,
            c.thread_id,
            c.user_id,
            c.parent_comment_id,
            c.content,
            c.created_at,
            t.forum_id,
            t.title AS thread_title,
            t.comment_count AS thread_comment_count,
            f.name AS forum_name,
            g.name AS game_name,
            ROW_NUMBER() OVER (PARTITION BY c.thread_id ORDER BY c.created_at ASC) AS row_num
          FROM comments c
          JOIN threads t ON c.thread_id = t.id
          JOIN forums f ON t.forum_id = f.id
          JOIN games g ON f.game_id = g.id
          WHERE c.user_id = $1 AND c.is_deleted = false
        )
        SELECT
          oc.id,
          oc.thread_id,
          oc.forum_id,
          oc.parent_comment_id,
          oc.content,
          oc.created_at,
          oc.thread_title,
          oc.thread_comment_count,
          oc.forum_name,
          oc.game_name,
          CEIL(oc.row_num / $4::numeric) AS thread_page,
          (
            SELECT COUNT(*)
            FROM comments c
            WHERE c.parent_comment_id = oc.id AND c.is_deleted = false
          ) AS reply_count
        FROM ordered_comments oc
        ORDER BY oc.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset, threadPageSize]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM comments WHERE user_id = $1 AND is_deleted = false',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Admin user comments retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', cacheResponse(30000), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, username, role, profile_picture_url, avatar_url, bio,
              total_posts, hide_reputation, created_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];
    let reputation = null;
    if (user.role !== 'admin' && !user.hide_reputation) {
      reputation = await getUserReputation(user.id, user.role);
    }

    res.status(200).json({
      data: { ...user, reputation },
      message: 'User retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Get all users (paginated)
router.get('/', cacheResponse(30000), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT id, username, role, profile_picture_url, avatar_url, bio, total_posts, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
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
router.post('/:id/ban', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
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
router.post('/:id/unban', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
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
router.put('/:id/role', authenticate, authorize('admin'), writeLimiter, async (req, res, next) => {
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
