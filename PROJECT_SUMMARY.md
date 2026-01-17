# MMORPG Forum Project Summary

**Date Created:** January 16, 2026  
**GitHub Repository:** https://github.com/TartuDen/MMORPG_forum_vibe1

---

## Snapshot
- Full-stack forum (React + Vite frontend, Node/Express backend, Postgres DB).
- Authentication: JWT access + refresh tokens, login via email OR username, register via email.
- Roles: admin/moderator/user; admin-only actions enforced in backend and UI.
- Demo seed: games, forums, admin user (pomogA/Plot123123), regular user (pomogB/Plot123123).

---

## Project Overview

A full-stack MMO/RPG Game Community Forum application with user authentication, forum management, threading system, and user profiles.

**Tech Stack:**
- **Backend:** Node.js 18+, Express.js, PostgreSQL 14+
- **Frontend:** React 18+, Vite, Axios, React Router, Context API
- **Authentication:** JWT access tokens + refresh token rotation (HttpOnly cookies + CSRF), bcryptjs password hashing
- **Database:** PostgreSQL with 10 tables (users, games, forums, threads, comments, moderation_log, refresh_tokens, conversations, conversation_participants, messages)

---

## Core Features Implemented

### Authentication & Users
- User registration with password validation (8+ chars, uppercase, lowercase, number)
- User login with JWT access cookie + refresh token rotation
- Token refresh mechanism (1hr access, 7-day refresh) using HttpOnly cookies
- CSRF protection for state-changing requests
- Logout endpoint clears auth cookies
- Protected routes (ProtectedRoute wrapper)
- User profiles with stats (total posts, threads, reputation, member since)
- Clickable usernames throughout the app (forums, threads, comments)
- Avatar upload (stored in DB as data URL, max 100KB)
- Profile option to hide reputation (admins never earn reputation)
- Security hardening (headers, origin checks, rate limits, account lockout, JWT issuer/audience)

### Forum Management
- Browse all forums
- Admin-only forum creation/deletion
- Game management (admin): create/update/delete games; tags are required; default forum auto-created
- Create threads in forums
- Edit/delete threads (owner only)
- Pinned threads support
- Thread view counter



### Reputation
- Upvote/downvote threads and comments (no self-voting)
- Voting requires configurable account age (admin setting)
- Thread and comment scores visible to everyone
- Realtime score updates via Socket.io on thread pages

### Search Functionality
- Full-text search on threads, comments, users, forums
- Tabbed results display
- Search pagination (20 items per tab)
- Integrated search bar in navbar
- Auto-select Forums tab when only forums match
- Query examples: `aion`, `pvp`, `pomogA`, `general discussion`

### UI/UX
- Professional CSS styling with color variables
- Responsive design (mobile-friendly)
- Form validation with error messages
- Character counters on forms
- Loading states and error handling
- Navbar with logo, search, auth buttons
- Direct messages UI with realtime updates
- Home: Game hub cards + single "General Discussion" hero card
- Forum page: game banner with icon, admin buttons (Manage Forum, Delete Forum)
- Thread page: admin can delete; shows avatar badge + thread image
- Create Thread: optional image upload, stays on new thread after create
- Create/Manage Games: checkbox tag selection, update form

### Messaging
- Direct messages (1:1) with conversation list
- Message search by username and "Message" from user profile
- Realtime delivery via Socket.io (with token auth)
- Unread counts and read receipts (per-conversation)

### Moderation
- Ban/unban users, promote role; moderation_log entries recorded
- Admin can delete threads, comments, forums, and games

---

## Images
- Avatars: upload as base64 data URL, max 100KB; stored in users.avatar_url
- Thread images: upload as base64 data URL, max 300KB; stored in threads.image_url
- Game icons: icon_url used as background on game cards and forum header banner
- Express body size limit increased to 512KB; oversized payload returns 413

---

## Deployment Considerations
- DB: PostgreSQL via pg client; pgAdmin optional for viewing tables
- Rate limiting (in-memory): general (120/min), auth (20/min), write (40/min)
- In-memory GET cache (short TTL): forums, games, search, user endpoints
- Limit enforcement: max limit=50 for list/search endpoints

---

## Environment Vars
- Backend .env: DB_HOST/PORT/NAME/USER/PASSWORD, PORT, NODE_ENV, JWT_SECRET, JWT_REFRESH_SECRET, SUPPORT_EMAIL
- Frontend .env: VITE_API_BASE_URL, VITE_SOCKET_IO_URL

---

## Schema Changes
- users.avatar_url
- users.is_banned/banned_at/banned_reason
- users.hide_reputation
- threads.image_url
- games.tags (TEXT[])
- games.auto_forum_enabled
- app_settings (min_account_age_days)
- thread_votes, comment_votes

---

## Migrations
- backend/migrations/001_add_user_ban_and_fk_restrict.sql (ban fields + FK restrict)
- backend/migrations/002_add_reputation.sql (reputation settings + vote tables)
- init.js also applies "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" for new columns

---

## Tests
- `backend/tests/auth.test.js` covers registration, login (email/username), admin game CRUD, role updates, ban, user actions, admin-only thread deletion
- Run: `npm test` in backend

---

## Known Behavior
- Errors for negative tests show in console (expected)
- Image uploads are base64 stored in DB (ok for demo, not ideal for production)

---

## Project Structure

```
MMORPG_forum_vibe1/
+-- backend/
�   +-- src/
�   �   +-- server.js                 # Express server entry point
�   �   +-- app.js                    # Express app & middleware setup
�   �   +-- db/
�   �   �   +-- connection.js         # PostgreSQL connection pool
�   �   �   +-- init.js               # Database schema initialization
�   �   +-- middleware/
�   �   �   +-- auth.js               # JWT authentication middleware
�   �   �   +-- errors.js             # Global error handler
�   �   +-- utils/
�   �   �   +-- jwt.js                # Token generation & verification
�   �   �   +-- password.js           # Password hashing utilities
�   �   �   +-- validators.js         # Input validation
�   �   +-- modules/
�   �   �   +-- users.js              # User registration, login, profile
�   �   �   +-- forums.js             # Forum CRUD operations
�   �   �   +-- threads.js            # Thread CRUD with view count
�   �   �   +-- comments.js           # Comment CRUD with soft delete
�   �   �   +-- search.js             # Full-text search operations
�   �   +-- config/
�   �       +-- authRoutes.js         # Auth endpoints (/register, /login, /me, /refresh, /logout)
�   �       +-- userRoutes.js         # User endpoints (GET /users/:id, /users)
�   �       +-- forumRoutes.js        # Forum, thread, comment endpoints
�   �       +-- searchRoutes.js       # Search endpoints
�   +-- .env                          # Environment variables (CREATE THIS)
�   +-- .env.example                  # Example env file
�   +-- package.json
�   +-- seed.js                       # Database seeding script
�
+-- frontend/
�   +-- src/
�   �   +-- App.jsx                   # Main routing component
�   �   +-- services/
�   �   �   +-- api.js                # Axios client & API endpoints
�   �   �   +-- authContext.jsx       # Auth state management (useAuth hook)
�   �   +-- components/
�   �   �   +-- Navbar.jsx            # Navigation bar with search
�   �   �   +-- Comment.jsx           # Comment display & editing
�   �   +-- pages/
�   �   �   +-- HomePage.jsx          # Forum listing (with Create Forum button)
�   �   �   +-- LoginPage.jsx         # Login form
�   �   �   +-- RegisterPage.jsx      # Registration form
�   �   �   +-- ForumPage.jsx         # Forum with threads
�   �   �   +-- ThreadPage.jsx        # Thread with comments
�   �   �   +-- CreateThreadPage.jsx  # Create thread form
�   �   �   +-- CreateForumPage.jsx   # Create forum form
�   �   �   +-- UserProfilePage.jsx   # User profile display
�   �   �   +-- SearchPage.jsx        # Search results (tabbed)
�   �   +-- styles/
�   �       +-- index.css             # Global styles & CSS variables
�   �       +-- navbar.css            # Navbar styling
�   �       +-- auth.css              # Auth pages styling
�   �       +-- home.css              # Forum list styling
�   �       +-- forum.css             # Forum page styling
�   �       +-- thread.css            # Thread page styling
�   �       +-- comment.css           # Comment component styling
�   �       +-- create-thread.css     # Create thread form styling
�   �       +-- create-forum.css      # Create forum form styling
�   �       +-- user-profile.css      # User profile styling
�   �       +-- search.css            # Search results styling
�   +-- .env                          # Environment variables (CREATE THIS)
�   +-- .env.example
�   +-- vite.config.js
�   +-- package.json
�
+-- README.md
```

---

## Database Schema

### users
```sql
id, username, email, password_hash, role, profile_picture_url, avatar_url, hide_reputation, bio,
total_posts, failed_login_attempts, locked_until, created_at, updated_at
```

### games
```sql
id, name, description, icon_url, website_url, created_at
```

### forums
```sql
id, game_id (FK), name, description, display_order, is_locked, created_at
```

### threads
```sql
id, forum_id (FK), user_id (FK), title, content, view_count, comment_count,
is_pinned, created_at, updated_at
```

### comments
```sql
id, thread_id (FK), user_id (FK), content, is_edited, is_deleted, created_at, updated_at
```

### moderation_log
```sql
id, moderator_id (FK), target_user_id (FK), action, reason, created_at
```

### refresh_tokens
```sql
id, user_id (FK), token_hash, expires_at, revoked_at, replaced_by, created_at, created_by_ip, revoked_by_ip
```

### conversations
```sql
id, created_at, updated_at
```

### conversation_participants
```sql
conversation_id (FK), user_id (FK), last_read_at
```



### app_settings
```sql
id, min_account_age_days, created_at, updated_at
```

### thread_votes
```sql
id, thread_id (FK), user_id (FK), value, created_at, updated_at
```

### comment_votes
```sql
id, comment_id (FK), user_id (FK), value, created_at, updated_at
```

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /refresh` - Refresh access token (cookie-based)
- `GET /me` - Get current user
- `PUT /me` - Update profile
- `GET /socket-token` - Issue socket token for realtime
- `POST /logout` - Clear auth cookies

### Users (`/api/users`)
- `GET /` - List all users (paginated)
- `GET /:id` - Get user by ID with stats

### Forums (`/api/forums`)
- `GET /` - List all forums
- `GET /games/all` - List all games
- `POST /create` - Create new forum (admin required)
- `GET /:forumId` - Get forum with threads
- `POST /:forumId/threads` - Create thread (auth required)
- `GET /:forumId/threads/:threadId` - Get thread with comments
- `PUT /:forumId/threads/:threadId` - Update thread (owner only)
- `DELETE /:forumId/threads/:threadId` - Delete thread (owner only)
- `POST /:forumId/threads/:threadId/comments` - Create comment (auth required)
- `PUT /:forumId/threads/:threadId/comments/:commentId` - Update comment (owner only)
- `DELETE /:forumId/threads/:threadId/comments/:commentId` - Delete comment (owner only)

### Search (`/api/search`)
- `GET /threads?q=query` - Search threads (full-text)
- `GET /comments?q=query` - Search comments
- `GET /users?q=query` - Search users
- `GET /forums?q=query` - Search forums



### Reputation (`/api/reputation`)
- `GET /settings` - Get reputation settings
- `PUT /settings` - Update reputation settings (admin)
- `POST /threads/:threadId/vote` - Vote on thread (-1, 0, 1)
- `POST /comments/:commentId/vote` - Vote on comment (-1, 0, 1)

---

## Setup Instructions (Local)

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ installed
- VS Code installed

### Step-by-step Setup

1. **Clone Repository:**
   ```bash
   git clone https://github.com/TartuDen/MMORPG_forum_vibe1.git
   cd MMORPG_forum_vibe1
   ```

2. **Install Dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

3. **Create Environment Files:**

   **backend/.env:**
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mmorpg_forum
   DB_USER=postgres
   DB_PASSWORD=your_password
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_change_in_production
   JWT_EXPIRE=1h
   JWT_REFRESH_EXPIRE=7d
   FRONTEND_URL=http://localhost:5173
   COOKIE_SAME_SITE=lax
   COOKIE_SECURE=false
   TRUST_PROXY=false
   ```

   **frontend/.env:**
   ```
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_SOCKET_IO_URL=http://localhost:5000
   ```

4. **Create PostgreSQL Database:**
   - Open pgAdmin
   - Create database: `mmorpg_forum`
   - Owner: `postgres`

5. **Seed Sample Data (Optional):**
   ```bash
   cd backend
   node seed.js
   ```

6. **Start Servers:**

   **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm start
   ```
   Expected: `Server running on port 5000`

   **Terminal 2 (Frontend):**
   ```bash
   cd frontend
   npm run dev
   ```
   Expected: `Local: http://localhost:5173/`

7. **Open Application:**
   - Go to `http://localhost:5173` in browser
   - Register a new account
   - Create forums, threads, and participate

---

## Common Development Tasks

### Adding a New Page
1. Create component in `frontend/src/pages/NewPage.jsx`
2. Import in `App.jsx`
3. Add route: `<Route path="/new-page" element={<NewPage />} />`
4. Create CSS file in `frontend/src/styles/new-page.css`

### Adding a New API Endpoint
1. Create module in `backend/src/modules/newModule.js`
2. Create/update routes in `backend/src/config/newRoutes.js`
3. Mount routes in `backend/src/app.js`: `app.use('/api/new', newRoutes)`
4. Add API methods in `frontend/src/services/api.js`

### Fixing Database Issues
```bash
# To reinitialize database:
# 1. Delete database in pgAdmin
# 2. Recreate it
# 3. Restart backend - schema will auto-initialize
```

---

## Security Notes

- Passwords are hashed with bcryptjs (10 salt rounds)
- Tokens stored in HttpOnly cookies, refresh tokens rotated server-side
- CSRF protection required for non-GET requests
- CORS enabled for localhost:5173
- JWT secret should be changed in production
- Password requirements: 8+ chars, uppercase, lowercase, number

---

## Next Features To Build

1. Categories/tags - Organize forums with categories
2. Real-time notifications - Forum reply notifications
3. Admin dashboard - Moderation tools
4. User roles - Admin, moderator, member permissions
5. Rich text editor - WYSIWYG for threads/comments
6. Message attachments - File/image sharing in DMs
7. Mobile PWA - Progressive Web App
8. Migrate image storage to object storage (S3/Cloudinary)
9. Persistent cache/ratelimits using Redis
10. Add dedicated "Manage Forum" panel (per-forum settings)
11. Add search filters in UI (tags, game, author)

---
## Troubleshooting

### Tests may hang
- `npm test` can hang after the auth/cookie changes; investigate open handles before running

### Port 5000 already in use
```bash
# Kill the old process (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Database connection failed
- Check PostgreSQL is running
- Verify DB credentials in `.env`
- Ensure `mmorpg_forum` database exists

### Frontend can't connect to backend
- Verify backend is running on port 5000
- Check CORS is enabled
- Verify `VITE_API_BASE_URL=http://localhost:5000/api` in frontend/.env

### Modules not found errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

---

## Git Workflow

```bash
# Check status
git status

# Stage changes
git add -A

# Commit
git commit -m "feat: Description of changes"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

---

## GitHub Account

- **Repository:** https://github.com/TartuDen/MMORPG_forum_vibe1
- **Username:** TartuDen
- **Email:** your_email@example.com

---

**Last Updated:** January 17, 2026  
**Status:** MVP Complete - Forums, threads, comments, profiles, avatars, search, direct messages












