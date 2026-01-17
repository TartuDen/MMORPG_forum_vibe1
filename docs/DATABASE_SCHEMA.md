# Database Schema

## Overview
This document describes the PostgreSQL database schema for the MMO/RPG Game Community Forum.

## Tables

### Users
Stores user account information and authentication details.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user')),
  is_banned BOOLEAN DEFAULT false,
  banned_at TIMESTAMP,
  banned_reason TEXT,
  profile_picture_url VARCHAR(500),
  bio TEXT,
  total_posts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**Columns:**
- `id`: Unique identifier (Primary Key)
- `username`: Unique username for login and display
- `email`: Unique email address
- `password_hash`: Bcryptjs hashed password
- `role`: User role (admin, moderator, user)
- `is_banned`: Whether the account is banned
- `banned_at`: Ban timestamp
- `banned_reason`: Ban reason text
- `profile_picture_url`: URL to user's profile picture
- `bio`: User biography/about me text
- `total_posts`: Cached count of user's posts
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update timestamp

### Games
Stores information about MMO/RPG games.

```sql
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  website_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_name ON games(name);
```

**Columns:**
- `id`: Unique identifier (Primary Key)
- `name`: Game name (unique)
- `description`: Game description
- `icon_url`: URL to game icon/logo
- `website_url`: Official game website
- `created_at`: Record creation timestamp

### Forums
Stores forum sections within each game.

```sql
CREATE TABLE forums (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forums_game_id ON forums(game_id);
CREATE INDEX idx_forums_display_order ON forums(display_order);
```

**Columns:**
- `id`: Unique identifier (Primary Key)
- `game_id`: Reference to parent game (Foreign Key)
- `name`: Forum name
- `description`: Forum description/purpose
- `display_order`: Order for displaying forums
- `is_locked`: Whether forum is locked from posting
- `created_at`: Record creation timestamp

### Threads
Stores discussion threads within forums.

```sql
CREATE TABLE threads (
  id SERIAL PRIMARY KEY,
  forum_id INTEGER NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  view_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_threads_forum_id ON threads(forum_id);
CREATE INDEX idx_threads_user_id ON threads(user_id);
CREATE INDEX idx_threads_created_at ON threads(created_at);
CREATE FULLTEXT INDEX idx_threads_search ON threads(title, content);
```

**Columns:**
- `id`: Unique identifier (Primary Key)
- `forum_id`: Reference to parent forum (Foreign Key)
- `user_id`: Reference to thread creator (Foreign Key)
- `title`: Thread title/subject
- `content`: Initial post content
- `view_count`: Number of times thread was viewed
- `comment_count`: Cached count of comments
- `is_locked`: Whether thread is locked from replies
- `is_pinned`: Whether thread is pinned to top
- `created_at`: Thread creation timestamp
- `updated_at`: Last edit timestamp

### Comments
Stores replies to threads.

```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_thread_id ON comments(thread_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
```

**Columns:**
- `id`: Unique identifier (Primary Key)
- `thread_id`: Reference to parent thread (Foreign Key)
- `user_id`: Reference to comment author (Foreign Key)
- `content`: Comment text content
- `is_edited`: Whether comment has been edited
- `is_deleted`: Soft delete flag
- `created_at`: Comment creation timestamp
- `updated_at`: Last edit timestamp

### Moderation Log
Stores moderation actions for auditing.

```sql
CREATE TABLE moderation_log (
  id SERIAL PRIMARY KEY,
  moderator_id INTEGER NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_moderation_log_created_at ON moderation_log(created_at);
CREATE INDEX idx_moderation_log_moderator ON moderation_log(moderator_id);
```

**Columns:**
- `id`: Unique identifier (Primary Key)
- `moderator_id`: Reference to moderator user (Foreign Key)
- `action_type`: Type of action (delete, lock, unlock, etc.)
- `target_type`: Type of target (thread, comment, user)
- `target_id`: ID of targeted resource
- `reason`: Reason for action
- `created_at`: Action timestamp

## Relationships

```
Games
  │
  └─→ Forums (1:M)
       │
       └─→ Threads (1:M)
            │
            ├─→ Users (M:1) - Thread Creator
            │
            └─→ Comments (1:M)
                 │
                 └─→ Users (M:1) - Comment Author

Users (1:M) Moderation Log (M:1)
```

## Indexes Strategy

- Foreign keys indexed for JOIN operations
- Timestamps indexed for sorting/filtering
- User ID indexed for filtering by author
- Game ID indexed for forum filtering
- Full-text search indexes on thread title/content for search functionality
- Display order indexed for forum ordering

## Migration Strategy

Initialize all tables on first application startup using the schema definitions in `backend/src/db/init.js`.
Apply migration scripts from `backend/migrations` when upgrading an existing database.
