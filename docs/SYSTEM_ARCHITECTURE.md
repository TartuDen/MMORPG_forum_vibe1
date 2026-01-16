# System Architecture

## Architecture Overview

The application follows a client-server architecture with real-time communication capabilities:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React 18 Application (Vite)                         │   │
│  │  - Components, Pages, Services                       │   │
│  │  - State Management (React Context/Hooks)           │   │
│  │  - Socket.io Client for Real-time Updates           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js Server with Middleware                   │   │
│  │  - CORS, Body Parser, Logger                         │   │
│  │  - JWT Authentication                               │   │
│  │  - Request Validation                               │   │
│  │  - Socket.io Server                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Modules                                             │   │
│  │  - Authentication Module                            │   │
│  │  - Forum Module                                      │   │
│  │  - Thread Module                                     │   │
│  │  - User Module                                       │   │
│  │  - Notification Module                              │   │
│  │  - Search Module                                     │   │
│  │  - Moderation Module                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                 │   │
│  │  - Connection Pooling (pg)                           │   │
│  │  - Query Execution                                   │   │
│  │  - Transaction Management                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Games Table
```sql
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Forums Table
```sql
CREATE TABLE forums (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Threads Table
```sql
CREATE TABLE threads (
  id SERIAL PRIMARY KEY,
  forum_id INTEGER REFERENCES forums(id),
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Comments Table
```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES threads(id),
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints Summary

### Authentication
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/refresh - Refresh JWT token
- POST /api/auth/logout - User logout

### Users
- GET /api/users/:id - Get user profile
- PUT /api/users/:id - Update user profile
- GET /api/users - List all users

### Forums
- GET /api/forums - List all forums
- GET /api/forums/:id - Get forum details
- POST /api/forums - Create forum (admin only)
- PUT /api/forums/:id - Update forum (admin only)

### Threads
- GET /api/threads - List threads
- GET /api/threads/:id - Get thread details
- POST /api/threads - Create thread
- PUT /api/threads/:id - Update thread
- DELETE /api/threads/:id - Delete thread

### Comments
- GET /api/threads/:threadId/comments - List comments
- POST /api/threads/:threadId/comments - Create comment
- PUT /api/comments/:id - Update comment
- DELETE /api/comments/:id - Delete comment

### Search
- GET /api/search?q=query - Full-text search

## Real-time Events (Socket.io)

### Server to Client
- `new_comment` - New comment added to thread
- `thread_updated` - Thread content updated
- `user_online` - User came online
- `user_offline` - User went offline
- `typing` - User is typing

### Client to Server
- `user_typing` - Notify others user is typing
- `stop_typing` - Notify user stopped typing

## Authentication Flow

1. User provides email and password
2. Server validates credentials and password hash
3. Server generates JWT token (1-hour expiry)
4. Server returns token and refresh token (7-day expiry)
5. Client stores tokens (localStorage/sessionStorage)
6. Client includes token in Authorization header for subsequent requests
7. Server validates token on protected routes
8. On token expiry, client uses refresh token to get new token

## Security Measures

1. Password hashing with bcryptjs (salt rounds: 10)
2. JWT token-based authentication
3. CORS configuration to trusted domains
4. Input validation using express-validator
5. SQL parameterized queries to prevent injection
6. Rate limiting on authentication endpoints
7. HTTPS enforcement in production
8. Secure headers (Helmet.js in production)

## Scalability Considerations

1. Database connection pooling
2. Stateless API design (horizontal scaling)
3. Redis caching layer (for frequently accessed data)
4. WebSocket namespace organization
5. Database indexes on frequently queried columns
6. API pagination and filtering
7. CDN for static assets
