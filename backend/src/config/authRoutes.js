import express from 'express';
import crypto from 'node:crypto';
import { registerUser, loginUser, getUserById, updateUser } from '../modules/users.js';
import { generateToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import pool from '../db/connection.js';
import { parseCookies } from '../utils/cookies.js';
import { CSRF_COOKIE_NAME, generateCsrfToken } from '../middleware/csrf.js';

const router = express.Router();

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === 'ms') return amount;
    if (unit === 's') return amount * 1000;
    if (unit === 'm') return amount * 60 * 1000;
    if (unit === 'h') return amount * 60 * 60 * 1000;
    if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  }

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) {
    return asNumber * 1000;
  }

  return fallbackMs;
};

const ACCESS_TTL_MS = parseDurationMs(process.env.JWT_EXPIRE, 60 * 60 * 1000);
const REFRESH_TTL_MS = parseDurationMs(process.env.JWT_REFRESH_EXPIRE, 7 * 24 * 60 * 60 * 1000);

const getCookieOptions = (overrides = {}) => {
  const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    ...overrides
  };
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createRefreshTokenRecord = async (userId, req) => {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, tokenHash, expiresAt, req.ip]
  );

  return { refreshToken, tokenId: result.rows[0].id };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions({ maxAge: ACCESS_TTL_MS }));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions({ maxAge: REFRESH_TTL_MS }));
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, getCookieOptions({ maxAge: 0 }));
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions({ maxAge: 0 }));
  res.clearCookie(CSRF_COOKIE_NAME, getCookieOptions({ httpOnly: false, maxAge: 0 }));
};

const setCsrfCookie = (res) => {
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions({ httpOnly: false, maxAge: REFRESH_TTL_MS }));
  return csrfToken;
};

const issueTokens = async (userId, req, res) => {
  const accessToken = generateToken(userId);
  const { refreshToken } = await createRefreshTokenRecord(userId, req);
  setAuthCookies(res, accessToken, refreshToken);
  return setCsrfCookie(res);
};

const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[REFRESH_COOKIE_NAME];
};

// Register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      });
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
      return res.status(400).json({
        error: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH'
      });
    }

    const user = await registerUser(username, email, password);
    const csrfToken = await issueTokens(user.id, req, res);

    res.status(201).json({
      data: {
        user,
        csrfToken
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      });
    }

    const user = await loginUser(identifier, password);
    const csrfToken = await issueTokens(user.id, req, res);

    res.status(200).json({
      data: {
        user,
        csrfToken
      },
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
});

// Refresh Token
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at, revoked_at, replaced_by
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const tokenRow = tokenResult.rows[0];
    const now = new Date();

    if (tokenRow.revoked_at || tokenRow.replaced_by) {
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, revoked_by_ip = $2
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [tokenRow.user_id, req.ip]
      );
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (new Date(tokenRow.expires_at) <= now) {
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, revoked_by_ip = $2
         WHERE id = $1`,
        [tokenRow.id, req.ip]
      );
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    const supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com';
    const bannedCheck = await pool.query('SELECT is_banned FROM users WHERE id = $1', [tokenRow.user_id]);
    if (bannedCheck.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    if (bannedCheck.rows[0].is_banned) {
      return res.status(403).json({
        error: `This user is banned. Please contact support at ${supportEmail}.`,
        code: 'USER_BANNED'
      });
    }

    const { refreshToken: newRefreshToken, tokenId } = await createRefreshTokenRecord(tokenRow.user_id, req);
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP, revoked_by_ip = $2, replaced_by = $3
       WHERE id = $1`,
      [tokenRow.id, req.ip, tokenId]
    );

    const newToken = generateToken(tokenRow.user_id);
    setAuthCookies(res, newToken, newRefreshToken);
    const csrfToken = setCsrfCookie(res);
    res.status(200).json({
      data: { csrfToken },
      message: 'Token refreshed'
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await getUserById(req.userId);
    res.status(200).json({
      data: user,
      message: 'User profile retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/me', authenticate, authLimiter, async (req, res, next) => {
  try {
    const { username, profile_picture_url, bio, avatar_url } = req.body;
    const user = await updateUser(req.userId, {
      username,
      profile_picture_url,
      bio,
      avatar_url
    });

    res.status(200).json({
      data: user,
      message: 'User profile updated'
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, revoked_by_ip = $2
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash, req.ip]
      );
    }

    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

export default router;
