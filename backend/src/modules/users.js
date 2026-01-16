import pool from '../db/connection.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { validateEmail, validateUsername, validatePassword, sanitizeUser } from '../utils/validators.js';

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

export const loginUser = async (email, password) => {
  // Find user by email
  const result = await pool.query(
    'SELECT id, username, email, password_hash, role FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw { status: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
  }

  const user = result.rows[0];

  // Compare password
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    throw { status: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
  }

  return sanitizeUser(user);
};

export const getUserById = async (userId) => {
  const result = await pool.query(
    'SELECT id, username, email, role, profile_picture_url, bio, total_posts, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
  }

  return result.rows[0];
};

export const updateUser = async (userId, updates) => {
  const allowedFields = ['username', 'profile_picture_url', 'bio'];
  const updates_obj = {};
  const updateParams = [];
  let paramCount = 1;

  for (const field of allowedFields) {
    if (field in updates) {
      updates_obj[field] = updates[field];
      updateParams.push(`${field} = $${paramCount}`);
      paramCount++;
    }
  }

  if (updateParams.length === 0) {
    throw { status: 400, message: 'No valid fields to update', code: 'NO_UPDATES' };
  }

  updateParams.push(`updated_at = CURRENT_TIMESTAMP`);

  const query = `UPDATE users SET ${updateParams.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, role, profile_picture_url, bio, total_posts, created_at, updated_at`;
  const values = [...Object.values(updates_obj), userId];

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    throw { status: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
  }

  return result.rows[0];
};
