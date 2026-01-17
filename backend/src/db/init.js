import pool from '../db/connection.js';
import pg from 'pg';
import dotenv from 'dotenv';
import { hashPassword } from '../utils/password.js';

dotenv.config();

const { Pool } = pg;

// Create database if it doesn't exist
const createDatabaseIfNotExists = async () => {
  const password = process.env.DB_PASSWORD;
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: password === undefined ? '' : String(password),
    database: 'postgres' // Connect to default postgres database
  });

  try {
    // Check if database exists
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME || 'mmorpg_forum']
    );

    if (result.rows.length === 0) {
      console.log(`Creating database: ${process.env.DB_NAME || 'mmorpg_forum'}...`);
      await adminPool.query(`CREATE DATABASE "${process.env.DB_NAME || 'mmorpg_forum'}" TEMPLATE template0`);
      console.log('Database created successfully');
    }
  } finally {
    await adminPool.end();
  }
};

export const initializeDatabase = async () => {
  try {
    // Create database if needed
    await createDatabaseIfNotExists();
    
    console.log('Initializing database schema...');

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
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
    `);
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS banned_reason TEXT;
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
    `);

    // Comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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

    // Seed default games if none exist
    const gameCount = await pool.query('SELECT COUNT(*) as total FROM games');
    if (parseInt(gameCount.rows[0].total, 10) === 0) {
      await pool.query(`
        INSERT INTO games (name, description, icon_url, website_url)
        VALUES
          ('World of Warcraft', 'Epic MMORPG with raids, dungeons, and PvP', '', 'https://worldofwarcraft.com'),
          ('Final Fantasy XIV', 'Story-driven MMORPG with deep crafting', '', 'https://www.finalfantasyxiv.com'),
          ('Guild Wars 2', 'Action MMORPG with dynamic events', '', 'https://www.guildwars2.com'),
          ('Elder Scrolls Online', 'Tamriel-wide MMORPG adventure', '', 'https://www.elderscrollsonline.com'),
          ('Black Desert Online', 'Sandbox MMORPG with lifeskills', '', 'https://www.naeu.playblackdesert.com'),
          ('Lost Ark', 'Isometric MMORPG with raids and islands', '', 'https://www.playlostark.com'),
          ('RuneScape', 'Classic MMORPG with open progression', '', 'https://www.runescape.com'),
          ('Old School RuneScape', 'Community-driven classic MMO', '', 'https://oldschool.runescape.com'),
          ('Albion Online', 'Sandbox PvP-focused MMORPG', '', 'https://albiononline.com'),
          ('New World', 'MMORPG set on the island of Aeternum', '', 'https://www.newworld.com'),
          ('Star Wars: The Old Republic', 'Story MMO in the Star Wars universe', '', 'https://www.swtor.com'),
          ('EVE Online', 'Space MMO with player-driven economy', '', 'https://www.eveonline.com'),
          ('The Lord of the Rings Online', 'MMORPG set in Middle-earth', '', 'https://www.lotro.com'),
          ('Phantasy Star Online 2', 'Sci-fi action MMORPG', '', 'https://pso2.com'),
          ('Aion', 'Fantasy MMORPG with aerial combat', '', 'https://www.aiononline.com')
        ON CONFLICT (name) DO NOTHING
      `);
    }

    // Seed default users in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      const passwordHash = await hashPassword('Plot123123');

      await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        ['pomogA', 'pomoga@example.com', passwordHash, 'admin']
      );

      await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        ['pomogB', 'pomogb@example.com', passwordHash, 'user']
      );
    }

    console.log('Database schema initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};
