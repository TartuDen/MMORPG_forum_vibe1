CREATE TABLE IF NOT EXISTS game_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_tags_name ON game_tags(name);

INSERT INTO game_tags (name)
SELECT unnest(ARRAY[
  'mmorpg', 'mmo', 'pve', 'pvp', 'raid', 'sandbox', 'story', 'crafting',
  'hardcore', 'casual', 'open-world', 'dungeon', 'online', 'single',
  'solo', 'party', 'full-loot'
])
ON CONFLICT (name) DO NOTHING;
