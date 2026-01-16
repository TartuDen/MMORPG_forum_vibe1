import pool from '../db/connection.js';

export const searchThreads = async (query, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  // Full-text search on threads
  const searchQuery = `
    SELECT 
      t.id, t.forum_id, t.user_id, t.title, t.content, 
      t.view_count, t.comment_count, t.is_locked, t.is_pinned,
      t.created_at, t.updated_at,
      u.username as author_username,
      f.name as forum_name
    FROM threads t
    JOIN users u ON t.user_id = u.id
    JOIN forums f ON t.forum_id = f.id
    WHERE t.title ILIKE $1 OR t.content ILIKE $1
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);

  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM threads WHERE title ILIKE $1 OR content ILIKE $1',
    [`%${query}%`]
  );
  const total = parseInt(countResult.rows[0].total);

  return {
    results: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

export const searchComments = async (query, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const searchQuery = `
    SELECT 
      c.id, c.thread_id, c.user_id, c.content,
      c.created_at, c.updated_at,
      u.username as author_username,
      t.title as thread_title
    FROM comments c
    JOIN users u ON c.user_id = u.id
    JOIN threads t ON c.thread_id = t.id
    WHERE c.content ILIKE $1 AND c.is_deleted = false
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);

  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM comments WHERE content ILIKE $1 AND is_deleted = false',
    [`%${query}%`]
  );
  const total = parseInt(countResult.rows[0].total);

  return {
    results: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

export const searchUsers = async (query, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const searchQuery = `
    SELECT 
      id, username, email, role, profile_picture_url, bio, total_posts, created_at
    FROM users
    WHERE username ILIKE $1 OR email ILIKE $1
    ORDER BY total_posts DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);

  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM users WHERE username ILIKE $1 OR email ILIKE $1',
    [`%${query}%`]
  );
  const total = parseInt(countResult.rows[0].total);

  return {
    results: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};
