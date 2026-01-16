import { verifyToken } from '../utils/jwt.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }

  req.userId = decoded.userId;
  next();
};

export const authorize = (requiredRole) => {
  return (req, res, next) => {
    // This will be extended when user roles are fetched from DB
    next();
  };
};
