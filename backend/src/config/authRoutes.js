import express from 'express';
import { registerUser, loginUser, getUserById, updateUser } from '../modules/users.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import pool from '../db/connection.js';

const router = express.Router();

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
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      data: {
        user,
        token,
        refreshToken
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
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(200).json({
      data: {
        user,
        token,
        refreshToken
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
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com';
    const bannedCheck = await pool.query('SELECT is_banned FROM users WHERE id = $1', [decoded.userId]);
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

    const newToken = generateToken(decoded.userId);
    res.status(200).json({
      data: { token: newToken },
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

export default router;
