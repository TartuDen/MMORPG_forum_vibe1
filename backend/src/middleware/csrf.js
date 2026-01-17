import crypto from 'node:crypto';
import { parseCookies } from '../utils/cookies.js';

export const CSRF_COOKIE_NAME = 'csrf_token';

export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const csrfProtection = ({ ignorePaths = [] } = {}) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    if (ignorePaths.includes(req.path)) {
      return next();
    }

    const cookies = parseCookies(req.headers.cookie);
    const csrfCookie = cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        code: 'INVALID_CSRF_TOKEN'
      });
    }

    return next();
  };
};
