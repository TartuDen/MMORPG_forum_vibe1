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
      f.name as forum_name,
      g.tags as game_tags
    FROM threads t
    JOIN users u ON t.user_id = u.id
    JOIN forums f ON t.forum_id = f.id
    JOIN games g ON f.game_id = g.id
    WHERE t.title ILIKE $1
      OR t.content ILIKE $1
      OR u.username ILIKE $1
      OR f.name ILIKE $1
      OR g.name ILIKE $1
      OR EXISTS (SELECT 1 FROM unnest(g.tags) tag WHERE tag ILIKE $1)
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM threads t
     JOIN users u ON t.user_id = u.id
     JOIN forums f ON t.forum_id = f.id
     JOIN games g ON f.game_id = g.id
     WHERE t.title ILIKE $1
       OR t.content ILIKE $1
       OR u.username ILIKE $1
       OR f.name ILIKE $1
       OR g.name ILIKE $1
       OR EXISTS (SELECT 1 FROM unnest(g.tags) tag WHERE tag ILIKE $1)`,
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
      t.title as thread_title,
      t.forum_id as forum_id,
      g.tags as game_tags
    FROM comments c
    JOIN users u ON c.user_id = u.id
    JOIN threads t ON c.thread_id = t.id
    JOIN forums f ON t.forum_id = f.id
    JOIN games g ON f.game_id = g.id
    WHERE c.is_deleted = false AND (
      c.content ILIKE $1
      OR u.username ILIKE $1
      OR t.title ILIKE $1
      OR f.name ILIKE $1
      OR g.name ILIKE $1
      OR EXISTS (SELECT 1 FROM unnest(g.tags) tag WHERE tag ILIKE $1)
    )
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM comments c
     JOIN users u ON c.user_id = u.id
     JOIN threads t ON c.thread_id = t.id
     JOIN forums f ON t.forum_id = f.id
     JOIN games g ON f.game_id = g.id
     WHERE c.is_deleted = false AND (
       c.content ILIKE $1
       OR u.username ILIKE $1
       OR t.title ILIKE $1
       OR f.name ILIKE $1
       OR g.name ILIKE $1
       OR EXISTS (SELECT 1 FROM unnest(g.tags) tag WHERE tag ILIKE $1)
     )`,
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
      id, username, role, profile_picture_url, bio, total_posts, created_at
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

export const searchForums = async (query, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const searchQuery = `
    SELECT
      f.id, f.game_id, f.name, f.description,
      g.name as game_name,
      g.tags as game_tags
    FROM forums f
    JOIN games g ON f.game_id = g.id
    WHERE f.name ILIKE $1
      OR f.description ILIKE $1
      OR g.name ILIKE $1
      OR EXISTS (SELECT 1 FROM unnest(g.tags) tag WHERE tag ILIKE $1)
    ORDER BY f.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);

  const countResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM forums f
     JOIN games g ON f.game_id = g.id
     WHERE f.name ILIKE $1
       OR f.description ILIKE $1
       OR g.name ILIKE $1
       OR EXISTS (SELECT 1 FROM unnest(g.tags) tag WHERE tag ILIKE $1)`,
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
