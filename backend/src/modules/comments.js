import pool from '../db/connection.js';

export const getThreadComments = async (threadId, page = 1, limit = 10, viewerId = null) => {
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      c.id, c.thread_id, c.user_id, c.content,
      c.is_edited, c.is_deleted, c.created_at, c.updated_at,
      u.username as author_username, u.profile_picture_url as author_picture, u.role as author_role, u.avatar_url as author_avatar_url,
      COALESCE((
        SELECT SUM(cv.value)
        FROM comment_votes cv
        WHERE cv.comment_id = c.id
      ), 0) as vote_score,
      (
        SELECT cv.value
        FROM comment_votes cv
        WHERE cv.comment_id = c.id AND cv.user_id = $4
      ) as viewer_vote
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.thread_id = $1 AND c.is_deleted = false
    ORDER BY c.created_at ASC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(query, [threadId, limit, offset, viewerId]);

  // Get total count
  const countResult = await pool.query('SELECT COUNT(*) as total FROM comments WHERE thread_id = $1 AND is_deleted = false', [threadId]);
  const total = parseInt(countResult.rows[0].total);

  return {
    comments: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

export const createComment = async (threadId, userId, content) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify thread exists
    const threadResult = await client.query('SELECT id FROM threads WHERE id = $1', [threadId]);
    if (threadResult.rows.length === 0) {
      throw { status: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' };
    }

    const result = await client.query(
      `INSERT INTO comments (thread_id, user_id, content) 
      VALUES ($1, $2, $3) 
      RETURNING id, thread_id, user_id, content, is_edited, is_deleted, created_at, updated_at`,
      [threadId, userId, content]
    );

    // Update thread comment_count
    await client.query('UPDATE threads SET comment_count = comment_count + 1 WHERE id = $1', [threadId]);

    // Update user's total_posts
    await client.query('UPDATE users SET total_posts = total_posts + 1 WHERE id = $1', [userId]);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateComment = async (commentId, userId, content) => {
  // Verify ownership
  const commentResult = await pool.query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
  if (commentResult.rows.length === 0) {
    throw { status: 404, message: 'Comment not found', code: 'COMMENT_NOT_FOUND' };
  }

  if (commentResult.rows[0].user_id !== userId) {
    throw { status: 403, message: 'Not authorized to update this comment', code: 'UNAUTHORIZED' };
  }

  const result = await pool.query(
    `UPDATE comments SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, thread_id, user_id, content, is_edited, is_deleted, created_at, updated_at`,
    [content, commentId]
  );

  return result.rows[0];
};

export const deleteComment = async (commentId, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const commentResult = await client.query('SELECT user_id, thread_id FROM comments WHERE id = $1', [commentId]);
    if (commentResult.rows.length === 0) {
      throw { status: 404, message: 'Comment not found', code: 'COMMENT_NOT_FOUND' };
    }

    if (commentResult.rows[0].user_id !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Not authorized to delete this comment', code: 'UNAUTHORIZED' };
    }

    // Soft delete comment
    await client.query('UPDATE comments SET is_deleted = true WHERE id = $1', [commentId]);

    // Decrement thread comment_count
    const threadId = commentResult.rows[0].thread_id;
    await client.query('UPDATE threads SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1', [threadId]);

    // Decrement user's total_posts
    await client.query('UPDATE users SET total_posts = GREATEST(0, total_posts - 1) WHERE id = $1', [userId]);

    await client.query('COMMIT');
    return { id: commentId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
