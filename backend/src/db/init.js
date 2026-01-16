import pool from '../db/connection.js';

export const initializeDatabase = async () => {
  try {
    console.log('Initializing database schema...');

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user')),
        profile_picture_url VARCHAR(500),
        bio TEXT,
        total_posts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Games table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        icon_url VARCHAR(500),
        website_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Forums table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forums (
        id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        display_order INTEGER DEFAULT 0,
        is_locked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Threads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        forum_id INTEGER NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        is_locked BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        is_edited BOOLEAN DEFAULT false,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Moderation log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS moderation_log (
        id SERIAL PRIMARY KEY,
        moderator_id INTEGER NOT NULL REFERENCES users(id),
        action_type VARCHAR(50) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id INTEGER NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_forums_game_id ON forums(game_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_forums_display_order ON forums(display_order);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threads_forum_id ON threads(forum_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_thread_id ON comments(thread_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_moderation_log_moderator ON moderation_log(moderator_id);`);

    console.log('Database schema initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};
