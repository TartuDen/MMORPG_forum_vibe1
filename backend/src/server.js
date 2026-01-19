import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/init.js';
import { parseCookies } from './utils/cookies.js';
import { verifyToken } from './utils/jwt.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Initialize database before starting server
await initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

const server = http.createServer(app);
const onlineUsers = new Map();

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

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.has(origin));
    },
    credentials: true
  }
});

const broadcastPresence = () => {
  io.emit('presence:update', { userIds: Array.from(onlineUsers.keys()) });
};

io.use((socket, next) => {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = socket.handshake.auth?.token || cookies.access_token;
  if (!token) {
    return next(new Error('unauthorized'));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('unauthorized'));
  }

  socket.userId = decoded.userId;
  return next();
});

io.on('connection', (socket) => {
  const currentCount = onlineUsers.get(socket.userId) || 0;
  onlineUsers.set(socket.userId, currentCount + 1);
  broadcastPresence();

  socket.join(`user:${socket.userId}`);

  socket.on('thread:join', (threadId) => {
    const threadIdValue = Number.parseInt(threadId, 10);
    if (!Number.isNaN(threadIdValue)) {
      socket.join(`thread:${threadIdValue}`);
    }
  });

  socket.on('thread:leave', (threadId) => {
    const threadIdValue = Number.parseInt(threadId, 10);
    if (!Number.isNaN(threadIdValue)) {
      socket.leave(`thread:${threadIdValue}`);
    }
  });

  socket.on('disconnect', () => {
    const count = onlineUsers.get(socket.userId) || 0;
    if (count <= 1) {
      onlineUsers.delete(socket.userId);
    } else {
      onlineUsers.set(socket.userId, count - 1);
    }
    broadcastPresence();
  });
});

app.set('io', io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
