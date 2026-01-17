import pool from '../db/connection.js';

export const getAllForums = async (gameId = null) => {
  let query = 'SELECT id, game_id, name, description, display_order, is_locked, created_at FROM forums';
  const params = [];

  if (gameId) {
    query += ' WHERE game_id = $1';
    params.push(gameId);
  }

  query += ' ORDER BY display_order ASC, created_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
};

export const getForumById = async (forumId) => {
  const result = await pool.query(
    'SELECT id, game_id, name, description, display_order, is_locked, created_at FROM forums WHERE id = $1',
    [forumId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' };
  }

  return result.rows[0];
};

export const createForum = async (gameId, name, description) => {
  const result = await pool.query(
    'INSERT INTO forums (game_id, name, description) VALUES ($1, $2, $3) RETURNING id, game_id, name, description, display_order, is_locked, created_at',
    [gameId, name, description]
  );

  return result.rows[0];
};

export const createGame = async (name, description, iconUrl = null, websiteUrl = null) => {
  const existing = await pool.query('SELECT id FROM games WHERE name = $1', [name]);
  if (existing.rows.length > 0) {
    throw { status: 400, message: 'Game already exists', code: 'GAME_EXISTS' };
  }

  const result = await pool.query(
    'INSERT INTO games (name, description, icon_url, website_url) VALUES ($1, $2, $3, $4) RETURNING id, name, description, icon_url, website_url, created_at',
    [name, description, iconUrl, websiteUrl]
  );

  return result.rows[0];
};

export const updateForum = async (forumId, updates) => {
  const allowedFields = ['name', 'description', 'display_order', 'is_locked'];
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

  values.push(forumId);

  const query = `UPDATE forums SET ${updateParams.join(', ')} WHERE id = $${paramCount} RETURNING id, game_id, name, description, display_order, is_locked, created_at`;

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' };
  }

  return result.rows[0];
};

export const deleteForum = async (forumId) => {
  const result = await pool.query('DELETE FROM forums WHERE id = $1 RETURNING id', [forumId]);

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' };
  }

  return result.rows[0];
};
