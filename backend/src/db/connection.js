import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const password = process.env.DB_PASSWORD;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mmorpg_forum',
  user: process.env.DB_USER || 'postgres',
  password: password === undefined ? '' : String(password),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
