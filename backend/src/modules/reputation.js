import pool from '../db/connection.js';

const DEFAULT_SETTINGS = {
  min_account_age_days: 0
};

export const getReputationSettings = async () => {
  const result = await pool.query('SELECT min_account_age_days FROM app_settings WHERE id = 1');
  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO app_settings (id, min_account_age_days) VALUES (1, $1) ON CONFLICT (id) DO NOTHING',
      [DEFAULT_SETTINGS.min_account_age_days]
    );
    return { ...DEFAULT_SETTINGS };
  }
  return result.rows[0];
};

export const updateReputationSettings = async (minAccountAgeDays) => {
  const result = await pool.query(
    `UPDATE app_settings
     SET min_account_age_days = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1
     RETURNING min_account_age_days`,
    [minAccountAgeDays]
  );

  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO app_settings (id, min_account_age_days) VALUES (1, $1) ON CONFLICT (id) DO NOTHING',
      [minAccountAgeDays]
    );
    return { min_account_age_days: minAccountAgeDays };
  }

  return result.rows[0];
};

export const ensureVotingAllowed = async (userId) => {
  const settings = await getReputationSettings();
  const minDays = Number.parseInt(settings.min_account_age_days, 10) || 0;
  if (minDays <= 0) {
    return;
  }

  const userResult = await pool.query('SELECT created_at FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
  }

  const createdAt = new Date(userResult.rows[0].created_at);
  const ageMs = Date.now() - createdAt.getTime();
  const minAgeMs = minDays * 24 * 60 * 60 * 1000;

  if (ageMs < minAgeMs) {
    throw {
      status: 403,
      message: `Voting is available after ${minDays} day(s).`,
      code: 'VOTING_TOO_SOON'
    };
  }
};

const getThreadVoteScore = async (client, threadId) => {
  const scoreResult = await client.query(
    'SELECT COALESCE(SUM(value), 0) AS score FROM thread_votes WHERE thread_id = $1',
    [threadId]
  );
  return Number(scoreResult.rows[0].score) || 0;
};

const getCommentVoteScore = async (client, commentId) => {
  const scoreResult = await client.query(
    'SELECT COALESCE(SUM(value), 0) AS score FROM comment_votes WHERE comment_id = $1',
    [commentId]
  );
  return Number(scoreResult.rows[0].score) || 0;
};

export const voteOnThread = async (threadId, userId, value) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const threadResult = await client.query('SELECT user_id FROM threads WHERE id = $1', [threadId]);
    if (threadResult.rows.length === 0) {
      throw { status: 404, message: 'Thread not found', code: 'THREAD_NOT_FOUND' };
    }

    if (threadResult.rows[0].user_id === userId) {
      throw { status: 403, message: 'Cannot vote on your own thread', code: 'SELF_VOTE' };
    }

    let userVote = null;

    if (value === 0) {
      await client.query('DELETE FROM thread_votes WHERE thread_id = $1 AND user_id = $2', [threadId, userId]);
    } else {
      await client.query(
        `INSERT INTO thread_votes (thread_id, user_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (thread_id, user_id)
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [threadId, userId, value]
      );
      userVote = value;
    }

    const score = await getThreadVoteScore(client, threadId);

    await client.query('COMMIT');
    return { score, user_vote: userVote };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const voteOnComment = async (commentId, userId, value) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const commentResult = await client.query(
      'SELECT user_id, is_deleted, thread_id FROM comments WHERE id = $1',
      [commentId]
    );
    if (commentResult.rows.length === 0) {
      throw { status: 404, message: 'Comment not found', code: 'COMMENT_NOT_FOUND' };
    }

    const commentRow = commentResult.rows[0];
    if (commentRow.is_deleted) {
      throw { status: 400, message: 'Cannot vote on deleted comment', code: 'COMMENT_DELETED' };
    }

    if (commentRow.user_id === userId) {
      throw { status: 403, message: 'Cannot vote on your own comment', code: 'SELF_VOTE' };
    }

    let userVote = null;

    if (value === 0) {
      await client.query('DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
    } else {
      await client.query(
        `INSERT INTO comment_votes (comment_id, user_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (comment_id, user_id)
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [commentId, userId, value]
      );
      userVote = value;
    }

    const score = await getCommentVoteScore(client, commentId);

    await client.query('COMMIT');
    return { score, user_vote: userVote, thread_id: commentRow.thread_id, comment_id: commentId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
