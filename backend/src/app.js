import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './config/authRoutes.js';
import userRoutes from './config/userRoutes.js';
import forumRoutes from './config/forumRoutes.js';
import searchRoutes from './config/searchRoutes.js';
import messageRoutes from './config/messageRoutes.js';
import reputationRoutes from './config/reputationRoutes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { initializeDatabase } from './db/init.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';

dotenv.config();

const app = express();

app.disable('x-powered-by');

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Initialize database on startup
let dbInitialized = false;

const ensureDbInitialized = async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error('Database initialization failed:', error);
    }
  }
  next();
};

app.use(ensureDbInitialized);

const parseAllowedOrigins = () => {
  const origins = new Set();
  const primary = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (primary) origins.add(primary);

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  const extra = process.env.FRONTEND_URLS || process.env.CORS_ALLOWED_ORIGINS;
  if (extra) {
    for (const origin of extra.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return origins;
};

const allowedOrigins = parseAllowedOrigins();

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  return false;
};

const getOriginFromHeaders = (req) => {
  const origin = req.headers.origin;
  if (origin) return origin;

  const referer = req.headers.referer;
  if (!referer) return null;
  try {
    const parsed = new URL(referer);
    return parsed.origin;
  } catch (error) {
    return null;
  }
};

const enforceOriginPolicy = (req, res, next) => {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const origin = getOriginFromHeaders(req);
  if (!origin) {
    return next();
  }

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({
      error: 'Origin not allowed',
      code: 'ORIGIN_NOT_ALLOWED'
    });
  }

  return next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );

  next();
};

// Middleware
app.use(securityHeaders);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    return callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true
}));

app.use(generalLimiter);

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(enforceOriginPolicy);
app.use(csrfProtection({ ignorePaths: ['/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/auth/resend-verification'] }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// User routes
app.use('/api/users', userRoutes);

// Forum routes
app.use('/api/forums', forumRoutes);

// Search routes
app.use('/api/search', searchRoutes);

// Messaging routes
app.use('/api/messages', messageRoutes);

// Reputation routes
app.use('/api/reputation', reputationRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

export default app;
