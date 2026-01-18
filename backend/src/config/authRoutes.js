import express from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { OAuth2Client } from 'google-auth-library';
import { registerUser, loginUser, getUserById, updateUser, findOrCreateGoogleUser } from '../modules/users.js';
import { generateToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import pool from '../db/connection.js';
import { parseCookies } from '../utils/cookies.js';
import { CSRF_COOKIE_NAME, generateCsrfToken } from '../middleware/csrf.js';
import { sendVerificationEmail } from '../utils/email.js';

const router = express.Router();

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';
const MAX_AVATAR_BYTES = 100 * 1024;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      const error = new Error('Only image files are allowed');
      error.status = 400;
      error.code = 'INVALID_IMAGE_TYPE';
      return cb(error);
    }
    return cb(null, true);
  }
});

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
const EMAIL_VERIFY_TTL_MS = parseDurationMs(process.env.EMAIL_VERIFY_EXPIRE, 24 * 60 * 60 * 1000);

const getCookieOptions = (overrides = {}) => {
  const sameSite = process.env.COOKIE_SAME_SITE
    || (process.env.NODE_ENV === 'production' ? 'strict' : 'lax');
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure,
    sameSite,
    ...(domain ? { domain } : {}),
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

const getVerificationBaseUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

const createEmailVerification = async (userId, email) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  await pool.query(
    `UPDATE email_verifications
     SET used_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  await pool.query(
    `INSERT INTO email_verifications (user_id, token_hash, email, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, email, expiresAt]
  );

  return rawToken;
};

const verifyGoogleCredential = async (credential) => {
  if (!googleClient) {
    throw { status: 500, message: 'Google OAuth is not configured', code: 'GOOGLE_OAUTH_NOT_CONFIGURED' };
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw { status: 401, message: 'Invalid Google token', code: 'INVALID_GOOGLE_TOKEN' };
  }

  return payload;
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
    const verificationToken = await createEmailVerification(user.id, user.email);
    const verificationUrl = `${getVerificationBaseUrl()}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail({
      to: user.email,
      username: user.username,
      verificationUrl
    });

    res.status(201).json({
      data: {
        email: user.email,
        ...(process.env.NODE_ENV !== 'production' ? { verificationUrl } : {})
      },
      message: 'Verification email sent'
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
router.post('/refresh', authLimiter, async (req, res, next) => {
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

// Verify email
router.get('/verify-email', async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Verification token required',
        code: 'MISSING_VERIFICATION_TOKEN'
      });
    }

    const tokenHash = hashToken(token);
    const result = await pool.query(
      `SELECT id, user_id, expires_at, used_at
       FROM email_verifications
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid verification token',
        code: 'INVALID_VERIFICATION_TOKEN'
      });
    }

    const record = result.rows[0];
    if (record.used_at) {
      return res.status(400).json({
        error: 'Verification token already used',
        code: 'VERIFICATION_TOKEN_USED'
      });
    }

    if (new Date(record.expires_at) <= new Date()) {
      return res.status(400).json({
        error: 'Verification token expired',
        code: 'VERIFICATION_TOKEN_EXPIRED'
      });
    }

    await pool.query(
      `UPDATE users
       SET is_email_verified = true, email_verified_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [record.user_id]
    );
    await pool.query(
      `UPDATE email_verifications
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [record.id]
    );

    res.status(200).json({
      message: 'Email verified'
    });
  } catch (error) {
    next(error);
  }
});

// Resend verification
router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    const result = await pool.query(
      `SELECT id, username, email, is_email_verified
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: 'If that account exists, a verification email has been sent.'
      });
    }

    const user = result.rows[0];
    if (user.is_email_verified) {
      return res.status(200).json({
        message: 'Email already verified.'
      });
    }

    const verificationToken = await createEmailVerification(user.id, user.email);
    const verificationUrl = `${getVerificationBaseUrl()}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail({
      to: user.email,
      username: user.username,
      verificationUrl
    });

    res.status(200).json({
      data: {
        ...(process.env.NODE_ENV !== 'production' ? { verificationUrl } : {})
      },
      message: 'Verification email sent'
    });
  } catch (error) {
    next(error);
  }
});

// Google OAuth (ID token)
router.post('/google', authLimiter, async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        error: 'Missing Google credential',
        code: 'MISSING_GOOGLE_CREDENTIAL'
      });
    }

    const payload = await verifyGoogleCredential(credential);
    const { sub, email, email_verified: emailVerified, name, picture } = payload;

    if (!email || emailVerified === false) {
      return res.status(400).json({
        error: 'Google account email is not verified',
        code: 'GOOGLE_EMAIL_NOT_VERIFIED'
      });
    }

    const user = await findOrCreateGoogleUser({
      googleId: sub,
      email,
      name,
      picture
    });
    const csrfToken = await issueTokens(user.id, req, res);

    res.status(200).json({
      data: {
        user,
        csrfToken
      },
      message: 'Google login successful'
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

// Socket token for realtime connections
router.get('/socket-token', authenticate, async (req, res, next) => {
  try {
    const token = generateToken(req.userId);
    res.status(200).json({
      data: { token },
      message: 'Socket token issued'
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/me', authenticate, authLimiter, async (req, res, next) => {
  try {
    const { username, profile_picture_url, bio, avatar_url, hide_reputation } = req.body;
    const user = await updateUser(req.userId, {
      username,
      profile_picture_url,
      bio,
      avatar_url,
      hide_reputation
    });

    res.status(200).json({
      data: user,
      message: 'User profile updated'
    });
  } catch (error) {
    next(error);
  }
});

// Upload avatar (multipart/form-data)
router.post('/me/avatar', authenticate, authLimiter, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Avatar file is required',
        code: 'MISSING_AVATAR'
      });
    }

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const user = await updateUser(req.userId, { avatar_url: dataUrl });

    res.status(200).json({
      data: user,
      message: 'Avatar updated'
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
