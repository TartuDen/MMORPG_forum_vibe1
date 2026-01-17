import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './config/authRoutes.js';
import userRoutes from './config/userRoutes.js';
import forumRoutes from './config/forumRoutes.js';
import searchRoutes from './config/searchRoutes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { initializeDatabase } from './db/init.js';

dotenv.config();

const app = express();

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

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

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

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

export default app;
