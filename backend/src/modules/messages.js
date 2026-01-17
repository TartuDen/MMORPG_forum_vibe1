import pool from '../db/connection.js';

export const createOrGetConversation = async (userId, otherUserId) => {
  if (userId === otherUserId) {
    throw { status: 400, message: 'Cannot message yourself', code: 'INVALID_CONVERSATION' };
  }

  const existing = await pool.query(
    `
      SELECT cp1.conversation_id
      FROM conversation_participants cp1
      JOIN conversation_participants cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = $1 AND cp2.user_id = $2
      LIMIT 1
    `,
    [userId, otherUserId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].conversation_id;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const conversation = await client.query(
      'INSERT INTO conversations DEFAULT VALUES RETURNING id'
    );
    const conversationId = conversation.rows[0].id;

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [conversationId, userId, otherUserId]
    );

    await client.query('COMMIT');
    return conversationId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listConversations = async (userId) => {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.updated_at,
        u.id AS other_user_id,
        u.username AS other_username,
        u.avatar_url AS other_avatar_url,
        u.profile_picture_url AS other_profile_picture_url,
        m.body AS last_message_body,
        m.created_at AS last_message_at,
        cp.last_read_at,
        (
          SELECT COUNT(*)
          FROM messages msg
          WHERE msg.conversation_id = c.id
            AND msg.sender_id <> $1
            AND msg.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamp)
        )::int AS unread_count
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id <> $1
      JOIN users u ON u.id = cp_other.user_id
      LEFT JOIN LATERAL (
        SELECT body, created_at
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC NULLS LAST, c.id DESC
    `,
    [userId]
  );

  return result.rows;
};

export const listMessages = async (conversationId, userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const membership = await pool.query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  if (membership.rows.length === 0) {
    throw { status: 403, message: 'Forbidden', code: 'FORBIDDEN' };
  }

  const result = await pool.query(
    `
      SELECT id, conversation_id, sender_id, body, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [conversationId, limit, offset]
  );

  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1',
    [conversationId]
  );
  const total = parseInt(countResult.rows[0].total, 10);

  return {
    messages: result.rows.reverse(),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

export const sendMessage = async (conversationId, senderId, body) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const membership = await client.query(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [conversationId]
    );
    if (membership.rows.length === 0) {
      throw { status: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
    }
    const isMember = membership.rows.some((row) => row.user_id === senderId);
    if (!isMember) {
      throw { status: 403, message: 'Forbidden', code: 'FORBIDDEN' };
    }

    const messageResult = await client.query(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, body, created_at`,
      [conversationId, senderId, body]
    );

    await client.query(
      `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    );

    await client.query(
      `UPDATE conversation_participants
       SET last_read_at = CASE WHEN user_id = $2 THEN CURRENT_TIMESTAMP ELSE last_read_at END
       WHERE conversation_id = $1`,
      [conversationId, senderId]
    );

    await client.query('COMMIT');
    return messageResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const markConversationRead = async (conversationId, userId) => {
  const result = await pool.query(
    `UPDATE conversation_participants
     SET last_read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING conversation_id`,
    [conversationId, userId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  return result.rows[0];
};

export const getOtherParticipantId = async (conversationId, userId) => {
  const result = await pool.query(
    `
      SELECT user_id
      FROM conversation_participants
      WHERE conversation_id = $1 AND user_id <> $2
      LIMIT 1
    `,
    [conversationId, userId]
  );

  return result.rows[0]?.user_id || null;
};
