import pool from '../db/connection.js';

export const getAllThreads = async (forumId, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      t.id, t.forum_id, t.user_id, t.title, t.content, 
      t.view_count, t.comment_count, t.is_locked, t.is_pinned,
      t.created_at, t.updated_at,
      u.username as author_username,
      u.profile_picture_url as author_picture
    FROM threads t
    JOIN users u ON t.user_id = u.id
    WHERE t.forum_id = $1
    ORDER BY t.is_pinned DESC, t.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [forumId, limit, offset]);

  // Get total count
  const countResult = await pool.query('SELECT COUNT(*) as total FROM threads WHERE forum_id = $1', [forumId]);
  const total = parseInt(countResult.rows[0].total);

  return {
    threads: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

export const getThreadById = async (threadId) => {
  const result = await pool.query(
    `SELECT 
      t.id, t.forum_id, t.user_id, t.title, t.content, 
      t.view_count, t.comment_count, t.is_locked, t.is_pinned,
      t.created_at, t.updated_at,
      u.id as author_id, u.username as author_username,
      u.profile_picture_url as author_picture
    FROM threads t
    JOIN users u ON t.user_id = u.id
    WHERE t.id = $1`,
    [threadId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' };
  }

  return result.rows[0];
};

export const createThread = async (forumId, userId, title, content) => {
  const result = await pool.query(
    `INSERT INTO threads (forum_id, user_id, title, content) 
    VALUES ($1, $2, $3, $4) 
    RETURNING id, forum_id, user_id, title, content, view_count, comment_count, is_locked, is_pinned, created_at, updated_at`,
    [forumId, userId, title, content]
  );

  // Update user's total_posts
  await pool.query('UPDATE users SET total_posts = total_posts + 1 WHERE id = $1', [userId]);

  return result.rows[0];
};

export const updateThread = async (threadId, userId, updates) => {
  // Verify ownership
  const threadResult = await pool.query('SELECT user_id FROM threads WHERE id = $1', [threadId]);
  if (threadResult.rows.length === 0) {
    throw { status: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' };
  }

  if (threadResult.rows[0].user_id !== userId) {
    throw { status: 403, message: 'Not authorized to update this thread', code: 'UNAUTHORIZED' };
  }

  const allowedFields = ['title', 'content', 'is_locked', 'is_pinned'];
  const updateParams = [];
  const values = [];
  let paramCount = 1;

  for (const field of allowedFields) {
    if (field in updates) {
      updateParams.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
      paramCount++;
    }
  }

  if (updateParams.length === 0) {
    throw { status: 400, message: 'No valid fields to update', code: 'NO_UPDATES' };
  }

  updateParams.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(threadId);

  const query = `UPDATE threads SET ${updateParams.join(', ')} WHERE id = $${paramCount} RETURNING id, forum_id, user_id, title, content, view_count, comment_count, is_locked, is_pinned, created_at, updated_at`;

  const result = await pool.query(query, values);

  return result.rows[0];
};

export const deleteThread = async (threadId, userId) => {
  // Verify ownership
  const threadResult = await pool.query('SELECT user_id FROM threads WHERE id = $1', [threadId]);
  if (threadResult.rows.length === 0) {
    throw { status: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' };
  }

  if (threadResult.rows[0].user_id !== userId) {
    throw { status: 403, message: 'Not authorized to delete this thread', code: 'UNAUTHORIZED' };
  }

  // Delete thread (cascade deletes comments)
  await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);

  // Decrement user's total_posts
  await pool.query('UPDATE users SET total_posts = GREATEST(0, total_posts - 1) WHERE id = $1', [userId]);

  return { id: threadId };
};

export const incrementThreadViews = async (threadId) => {
  await pool.query('UPDATE threads SET view_count = view_count + 1 WHERE id = $1', [threadId]);
};
