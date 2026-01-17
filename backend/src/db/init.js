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
        avatar_url TEXT,
        hide_reputation BOOLEAN DEFAULT false,
        profile_picture_url VARCHAR(500),
        bio TEXT,
        total_posts INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS banned_reason TEXT,
        ADD COLUMN IF NOT EXISTS avatar_url TEXT,
        ADD COLUMN IF NOT EXISTS hide_reputation BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
    `);

    // Games table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        tags TEXT[] DEFAULT '{}',
        icon_url VARCHAR(500),
        website_url VARCHAR(500),
        auto_forum_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE games
        ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS auto_forum_enabled BOOLEAN DEFAULT true;
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
        image_url TEXT,
        view_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        is_locked BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE threads
        ADD COLUMN IF NOT EXISTS image_url TEXT;
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

    // Reputation settings (single row)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        min_account_age_days INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Thread votes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS thread_votes (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (thread_id, user_id)
      );
    `);

    // Comment votes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_votes (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (comment_id, user_id)
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

    // Refresh tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        replaced_by INTEGER REFERENCES refresh_tokens(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by_ip VARCHAR(100),
        revoked_by_ip VARCHAR(100)
      );
    `);

    // Conversations table (DMs only)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Conversation participants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id)
      );
    `);

    // Messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
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
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_thread_votes_thread_id ON thread_votes(thread_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_thread_votes_user_id ON thread_votes(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON comment_votes(comment_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON comment_votes(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_moderation_log_moderator ON moderation_log(moderator_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);`);

    await pool.query(`
      INSERT INTO app_settings (id, min_account_age_days)
      VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING
    `);

    // Seed default games if none exist
    const gameCount = await pool.query('SELECT COUNT(*) as total FROM games');
    if (parseInt(gameCount.rows[0].total, 10) === 0) {
      await pool.query(`
        INSERT INTO games (name, description, tags, icon_url, website_url)
        VALUES
          ('World of Warcraft', 'Epic MMORPG with raids, dungeons, and PvP', ARRAY['mmorpg','pve','pvp','raid'], '', 'https://worldofwarcraft.com'),
          ('Final Fantasy XIV', 'Story-driven MMORPG with deep crafting', ARRAY['mmorpg','pve','story','raid'], '', 'https://www.finalfantasyxiv.com'),
          ('Guild Wars 2', 'Action MMORPG with dynamic events', ARRAY['mmorpg','pve','pvp','wvw'], '', 'https://www.guildwars2.com'),
          ('Elder Scrolls Online', 'Tamriel-wide MMORPG adventure', ARRAY['mmorpg','pve','pvp','story'], '', 'https://www.elderscrollsonline.com'),
          ('Black Desert Online', 'Sandbox MMORPG with lifeskills', ARRAY['mmorpg','pvp','sandbox'], '', 'https://www.naeu.playblackdesert.com'),
          ('Lost Ark', 'Isometric MMORPG with raids and islands', ARRAY['mmorpg','pve','raid'], '', 'https://www.playlostark.com'),
          ('RuneScape', 'Classic MMORPG with open progression', ARRAY['mmorpg','sandbox','pve'], '', 'https://www.runescape.com'),
          ('Old School RuneScape', 'Community-driven classic MMO', ARRAY['mmorpg','sandbox','pve'], '', 'https://oldschool.runescape.com'),
          ('Albion Online', 'Sandbox PvP-focused MMORPG', ARRAY['mmorpg','pvp','sandbox','full-loot'], '', 'https://albiononline.com'),
          ('New World', 'MMORPG set on the island of Aeternum', ARRAY['mmorpg','pvp','pve'], '', 'https://www.newworld.com'),
          ('Star Wars: The Old Republic', 'Story MMO in the Star Wars universe', ARRAY['mmorpg','story','pve'], '', 'https://www.swtor.com'),
          ('EVE Online', 'Space MMO with player-driven economy', ARRAY['mmorpg','pvp','sandbox','space'], '', 'https://www.eveonline.com'),
          ('The Lord of the Rings Online', 'MMORPG set in Middle-earth', ARRAY['mmorpg','pve','story'], '', 'https://www.lotro.com'),
          ('Phantasy Star Online 2', 'Sci-fi action MMORPG', ARRAY['mmorpg','pve','action'], '', 'https://pso2.com'),
          ('Aion', 'Fantasy MMORPG with aerial combat', ARRAY['mmorpg','pvp','pve'], '', 'https://www.aiononline.com')
        ON CONFLICT (name) DO NOTHING
      `);
    }

    await pool.query(`
      INSERT INTO games (name, description, tags, icon_url, website_url)
      VALUES ('Community', 'Site-wide general discussion', ARRAY['community','general'], '', '')
      ON CONFLICT (name) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO forums (game_id, name, description)
      SELECT g.id, 'General Discussion', 'Site-wide general discussion'
      FROM games g
      LEFT JOIN forums f ON f.game_id = g.id AND f.name = 'General Discussion'
      WHERE g.name = 'Community' AND f.id IS NULL
    `);

    await pool.query(`
      INSERT INTO forums (game_id, name, description)
      SELECT g.id, 'General Discussion', 'General discussion for ' || g.name
      FROM games g
      LEFT JOIN forums f ON f.game_id = g.id
      WHERE f.id IS NULL AND g.name <> 'Community' AND g.auto_forum_enabled = true
    `);

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
