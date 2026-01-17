import pool from '../db/connection.js';

export const getAllForums = async (gameId = null) => {
  let query = `
    SELECT
      f.id,
      f.game_id,
      f.name,
      f.description,
      f.display_order,
      f.is_locked,
      f.created_at,
      g.name as game_name,
      g.description as game_description,
      g.icon_url as game_icon_url
    FROM forums f
    JOIN games g ON f.game_id = g.id
  `;
  const params = [];

  if (gameId) {
    query += ' WHERE f.game_id = $1';
    params.push(gameId);
  }

  query += ' ORDER BY f.display_order ASC, f.created_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
};

export const getForumById = async (forumId) => {
  const result = await pool.query(
    `SELECT
      f.id,
      f.game_id,
      f.name,
      f.description,
      f.display_order,
      f.is_locked,
      f.created_at,
      g.name as game_name,
      g.description as game_description,
      g.icon_url as game_icon_url
     FROM forums f
     JOIN games g ON f.game_id = g.id
     WHERE f.id = $1`,
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

export const createGame = async (name, description, tags, iconUrl = null, websiteUrl = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM games WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      throw { status: 400, message: 'Game already exists', code: 'GAME_EXISTS' };
    }

    const result = await client.query(
      'INSERT INTO games (name, description, tags, icon_url, website_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, description, tags, icon_url, website_url, created_at',
      [name, description, tags, iconUrl, websiteUrl]
    );

    await client.query(
      `INSERT INTO forums (game_id, name, description)
       VALUES ($1, $2, $3)`,
      [result.rows[0].id, 'General Discussion', `General discussion for ${name}`]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateGame = async (gameId, updates) => {
  const allowedFields = ['name', 'description', 'tags', 'icon_url', 'website_url'];
  const updateParams = [];
  const values = [];
  let paramCount = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateParams.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
      paramCount++;
    }
  }

  if (updateParams.length === 0) {
    throw { status: 400, message: 'No valid fields to update', code: 'NO_UPDATES' };
  }

  values.push(gameId);

  const result = await pool.query(
    `UPDATE games SET ${updateParams.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, name, description, tags, icon_url, website_url, created_at`,
    values
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Game not found', code: 'GAME_NOT_FOUND' };
  }

  return result.rows[0];
};

export const deleteGame = async (gameId) => {
  const gameResult = await pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
  if (gameResult.rows.length === 0) {
    throw { status: 404, message: 'Game not found', code: 'GAME_NOT_FOUND' };
  }
  if (gameResult.rows[0].name === 'Community') {
    throw { status: 403, message: 'Community game cannot be deleted', code: 'FORBIDDEN' };
  }

  const result = await pool.query('DELETE FROM games WHERE id = $1 RETURNING id', [gameId]);
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
  const forumResult = await pool.query(
    `SELECT f.id, f.game_id, g.name as game_name
     FROM forums f
     JOIN games g ON f.game_id = g.id
     WHERE f.id = $1`,
    [forumId]
  );

  if (forumResult.rows.length === 0) {
    throw { status: 404, message: 'Forum not found', code: 'FORUM_NOT_FOUND' };
  }

  const forum = forumResult.rows[0];
  const countResult = await pool.query('SELECT COUNT(*) as total FROM forums WHERE game_id = $1', [forum.game_id]);
  const total = parseInt(countResult.rows[0].total, 10);

  if (total <= 1) {
    throw { status: 403, message: 'Cannot delete the last forum for a game', code: 'FORUM_REQUIRED' };
  }

  const result = await pool.query('DELETE FROM forums WHERE id = $1 RETURNING id', [forumId]);
  return result.rows[0];
};
