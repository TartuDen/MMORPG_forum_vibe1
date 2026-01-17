import { verifyToken } from '../utils/jwt.js';
import pool from '../db/connection.js';
import { parseCookies } from '../utils/cookies.js';

export const authenticate = async (req, res, next) => {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com';
  const authHeader = req.headers['authorization'];
  const cookies = parseCookies(req.headers.cookie);
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const token = bearerToken || cookies.access_token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }

  try {
    const result = await pool.query('SELECT role, is_banned FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    if (result.rows[0].is_banned) {
      return res.status(403).json({
        error: `This user is banned. Please contact support at ${supportEmail}.`,
        code: 'USER_BANNED'
      });
    }
    req.userRole = result.rows[0].role;
  } catch (err) {
    return next(err);
  }

  req.userId = decoded.userId;
  next();
};

export const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (!requiredRole) {
      return next();
    }

    if (!req.userRole) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    if (req.userRole !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    next();
  };
};
