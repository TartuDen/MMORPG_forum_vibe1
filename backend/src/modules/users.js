import crypto from 'node:crypto';
import pool from '../db/connection.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { validateEmail, validateUsername, validatePassword, sanitizeUser, parseImageDataUrl } from '../utils/validators.js';

const MAX_FAILED_LOGIN_ATTEMPTS = Number.parseInt(
  process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5',
  10
);
const LOGIN_LOCKOUT_MINUTES = Number.parseInt(
  process.env.LOGIN_LOCKOUT_MINUTES || '15',
  10
);

const normalizeUsername = (value) => {
  if (!value) return 'user';
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleaned.length < 3) {
    return 'user';
  }
  return cleaned.slice(0, 20);
};

const createUniqueUsername = async (base) => {
  let candidate = normalizeUsername(base);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (!validateUsername(candidate)) {
      candidate = normalizeUsername(`user_${crypto.randomInt(1000, 9999)}`);
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (existing.rows.length === 0) {
      return candidate;
    }

    const suffix = crypto.randomInt(1000, 9999);
    const trimmed = candidate.slice(0, Math.max(3, 20 - String(suffix).length));
    candidate = `${trimmed}${suffix}`;
  }

  return `user${crypto.randomInt(100000, 999999)}`;
};

const ensureAccountActive = (user) => {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com';
  if (user.is_banned) {
    throw {
      status: 403,
      message: `This user is banned. Please contact support at ${supportEmail}.`,
      code: 'USER_BANNED'
    };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw {
      status: 403,
      message: 'Account is temporarily locked. Please try again later.',
      code: 'ACCOUNT_LOCKED'
    };
  }
};

export const registerUser = async (username, email, password) => {
  // Validate inputs
  if (!validateUsername(username)) {
    throw { status: 400, message: 'Invalid username format (3-20 alphanumeric characters)', code: 'INVALID_USERNAME' };
  }
  if (!validateEmail(email)) {
    throw { status: 400, message: 'Invalid email format', code: 'INVALID_EMAIL' };
  }
  if (!validatePassword(password)) {
    throw { status: 400, message: 'Password must be at least 8 characters with uppercase, lowercase, and number', code: 'WEAK_PASSWORD' };
  }

  // Check if user exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existingUser.rows.length > 0) {
    throw { status: 400, message: 'User already exists', code: 'USER_EXISTS' };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const result = await pool.query(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
    [username, email, passwordHash, 'user']
  );

  return sanitizeUser(result.rows[0]);
};

export const loginUser = async (identifier, password) => {
  // Find user by email or username
  const result = await pool.query(
    `SELECT id, username, email, password_hash, role, is_banned, avatar_url,
            hide_reputation, failed_login_attempts, locked_until,
            is_email_verified, email_verified_at
     FROM users
     WHERE email = $1 OR username = $1`,
    [identifier]
  );

  if (result.rows.length === 0) {
    throw { status: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
  }

  const user = result.rows[0];
  ensureAccountActive(user);
  if (!user.is_email_verified) {
    throw {
      status: 403,
      message: 'Please verify your email before logging in.',
      code: 'EMAIL_NOT_VERIFIED'
    };
  }

  // Compare password
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= $2 THEN CURRENT_TIMESTAMP + ($3 || ' minutes')::interval
             ELSE locked_until
           END
       WHERE id = $1`,
      [user.id, MAX_FAILED_LOGIN_ATTEMPTS, `${LOGIN_LOCKOUT_MINUTES}`]
    );
    throw { status: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
  }

  if (user.failed_login_attempts > 0 || user.locked_until) {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [user.id]
    );
  }

  return sanitizeUser(user);
};

export const findOrCreateGoogleUser = async ({ googleId, email, name, picture }) => {
  if (!googleId || !email) {
    throw { status: 400, message: 'Missing Google account details', code: 'MISSING_GOOGLE_DETAILS' };
  }

  const existingGoogle = await pool.query(
    `SELECT id, username, email, role, is_banned, locked_until, auth_provider, google_id, profile_picture_url
     FROM users
     WHERE google_id = $1`,
    [googleId]
  );

  if (existingGoogle.rows.length > 0) {
    const user = existingGoogle.rows[0];
    ensureAccountActive(user);
    return sanitizeUser(user);
  }

  const existingEmail = await pool.query(
    `SELECT id, username, email, role, is_banned, locked_until, auth_provider, google_id, profile_picture_url
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (existingEmail.rows.length > 0) {
    const user = existingEmail.rows[0];
    ensureAccountActive(user);

    if (user.google_id && user.google_id !== googleId) {
      throw { status: 409, message: 'Google account already linked', code: 'GOOGLE_ACCOUNT_CONFLICT' };
    }

    const updateResult = await pool.query(
      `UPDATE users
       SET google_id = $1,
           auth_provider = 'google',
           is_email_verified = true,
           email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
           profile_picture_url = COALESCE(profile_picture_url, $2)
       WHERE id = $3
       RETURNING id, username, email, role, auth_provider, google_id, profile_picture_url, created_at, is_email_verified`,
      [googleId, picture || null, user.id]
    );

    return sanitizeUser(updateResult.rows[0]);
  }

  const baseUsername = name || email.split('@')[0];
  const username = await createUniqueUsername(baseUsername);
  const randomPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await hashPassword(randomPassword);

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, role, auth_provider, google_id, profile_picture_url, is_email_verified, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
     RETURNING id, username, email, role, auth_provider, google_id, profile_picture_url, created_at, is_email_verified`,
    [username, email, passwordHash, 'user', 'google', googleId, picture || null]
  );

  return sanitizeUser(result.rows[0]);
};

export const getUserById = async (userId) => {
  const result = await pool.query(
    `SELECT id, username, email, role, profile_picture_url, avatar_url, bio,
            total_posts, hide_reputation, is_email_verified, email_verified_at, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
  }

  const user = result.rows[0];
  const reputation = await getUserReputation(userId, user.role);
  return { ...user, reputation };
};

export const updateUser = async (userId, updates) => {
  const allowedFields = ['username', 'profile_picture_url', 'bio', 'avatar_url', 'hide_reputation'];
  const updates_obj = {};
  const updateParams = [];
  let paramCount = 1;

  if (updates.avatar_url) {
    parseImageDataUrl(updates.avatar_url, 100 * 1024);
  }

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updates_obj[field] = updates[field];
      updateParams.push(`${field} = $${paramCount}`);
      paramCount++;
    }
  }

  if (updateParams.length === 0) {
    throw { status: 400, message: 'No valid fields to update', code: 'NO_UPDATES' };
  }

  updateParams.push(`updated_at = CURRENT_TIMESTAMP`);

  const query = `UPDATE users SET ${updateParams.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, role, profile_picture_url, avatar_url, bio, total_posts, hide_reputation, created_at, updated_at`;
  const values = [...Object.values(updates_obj), userId];

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
  }

  const user = result.rows[0];
  const reputation = await getUserReputation(userId, user.role);
  return { ...user, reputation };
};

export async function getUserReputation(userId, role = null) {
  if (role === 'admin') {
    return null;
  }

  const threadScoreResult = await pool.query(
    `SELECT COALESCE(SUM(tv.value), 0) AS score
     FROM thread_votes tv
     JOIN threads t ON tv.thread_id = t.id
     WHERE t.user_id = $1`,
    [userId]
  );

  const commentScoreResult = await pool.query(
    `SELECT COALESCE(SUM(cv.value), 0) AS score
     FROM comment_votes cv
     JOIN comments c ON cv.comment_id = c.id
     WHERE c.user_id = $1 AND c.is_deleted = false`,
    [userId]
  );

  const threadScore = Number(threadScoreResult.rows[0].score) || 0;
  const commentScore = Number(commentScoreResult.rows[0].score) || 0;
  return threadScore + commentScore;
}

export const updateUserRole = async (targetUserId, newRole, moderatorId) => {
  const validRoles = ['admin', 'moderator', 'user'];
  if (!validRoles.includes(newRole)) {
    throw { status: 400, message: 'Invalid role', code: 'INVALID_ROLE' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetResult = await client.query(
      'SELECT id, role, is_super_admin FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetResult.rows.length === 0) {
      throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
    }

    const targetUser = targetResult.rows[0];
    if (targetUser.is_super_admin && newRole !== 'admin') {
      throw { status: 403, message: 'Super admin role cannot be changed', code: 'SUPER_ADMIN_IMMUTABLE' };
    }

    const result = await client.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, username, role, is_banned`,
      [newRole, targetUserId]
    );

    await client.query(
      `INSERT INTO moderation_log (moderator_id, action_type, target_type, target_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [moderatorId, 'update_role', 'user', targetUserId, `role=${newRole}`]
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

export const banUser = async (targetUserId, moderatorId, reason = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE users
       SET is_banned = true,
           banned_at = CURRENT_TIMESTAMP,
           banned_reason = $1
       WHERE id = $2
       RETURNING id, username, role, is_banned, banned_at, banned_reason`,
      [reason, targetUserId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
    }

    await client.query(
      `INSERT INTO moderation_log (moderator_id, action_type, target_type, target_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [moderatorId, 'ban_user', 'user', targetUserId, reason]
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

export const unbanUser = async (targetUserId, moderatorId, reason = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE users
       SET is_banned = false,
           banned_at = NULL,
           banned_reason = NULL
       WHERE id = $1
       RETURNING id, username, role, is_banned, banned_at, banned_reason`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
    }

    await client.query(
      `INSERT INTO moderation_log (moderator_id, action_type, target_type, target_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [moderatorId, 'unban_user', 'user', targetUserId, reason]
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
