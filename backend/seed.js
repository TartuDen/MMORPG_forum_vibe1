import pool from './src/db/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('Seeding database with sample data...');

    // Insert sample games
    const gamesResult = await pool.query(`
      INSERT INTO games (name, description, icon_url, website_url)
      VALUES
        ('World of Warcraft', 'Epic MMORPG with raids, dungeons, and PvP', '🐉', 'https://worldofwarcraft.com'),
        ('Final Fantasy XIV', 'Japanese MMORPG with rich story and crafting', '⚔️', 'https://ffxiv.com'),
        ('Elder Scrolls Online', 'Fantasy MMORPG set in Tamriel', '🗡️', 'https://elderscrollsonline.com'),
        ('Guild Wars 2', 'Action-based MMORPG with dynamic events', '⚡', 'https://guildwars2.com')
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `);

    // Get all game IDs
    const allGames = await pool.query('SELECT id FROM games');
    const gameIds = allGames.rows.map(row => row.id);

    if (gameIds.length === 0) {
      console.log('No games found. Please check database.');
      return;
    }

    // Insert sample forums
    const forumData = [
      { gameId: gameIds[0], name: 'General Discussion', description: 'General WoW discussions' },
      { gameId: gameIds[0], name: 'Raiding', description: 'Raid strategies and discussions' },
      { gameId: gameIds[0], name: 'PvP Arena', description: 'Competitive PvP discussions' },
      { gameId: gameIds[1], name: 'General Discussion', description: 'General FFXIV discussions' },
      { gameId: gameIds[1], name: 'Raids & Dungeons', description: 'Raid guides and strategies' },
      { gameId: gameIds[1], name: 'Crafting & Trading', description: 'Crafting tips and market discussion' },
      { gameId: gameIds[2], name: 'General Discussion', description: 'General ESO discussions' },
      { gameId: gameIds[2], name: 'PvP Cyrodiil', description: 'Cyrodiil PvP discussions' },
      { gameId: gameIds[3], name: 'General Discussion', description: 'General GW2 discussions' },
      { gameId: gameIds[3], name: 'Fractals & Raids', description: 'Endgame content discussion' },
    ];

    for (const forum of forumData) {
      await pool.query(
        `INSERT INTO forums (game_id, name, description, display_order)
         VALUES ($1, $2, $3, (SELECT COUNT(*) FROM forums WHERE game_id = $1))
         ON CONFLICT DO NOTHING`,
        [forum.gameId, forum.name, forum.description]
      );
    }

    console.log('✅ Database seeded successfully!');
    console.log(`✅ Created ${forumData.length} forums across multiple games`);
    console.log('\nYou can now:');
    console.log('1. Go to http://localhost:5173');
    console.log('2. Register/Login');
    console.log('3. Browse forums and create threads!');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
};

seedDatabase();
