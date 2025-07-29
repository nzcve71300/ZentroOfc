const pool = require('../db');

/**
 * Initialize database tables if they don't exist
 * This prevents crashes when tables are missing
 */
async function initializeDatabase() {
  console.log('Initializing database tables...');
  
  try {
    // Ensure link_requests table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_requests (
        id SERIAL PRIMARY KEY,
        guild_id INT NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        requested_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes'),
        status TEXT DEFAULT 'pending',
        UNIQUE(guild_id, discord_id, server_id)
      );
    `);

    // Ensure link_blocks table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_blocks (
        id SERIAL PRIMARY KEY,
        guild_id INT NOT NULL,
        discord_id BIGINT NULL,
        ign TEXT NULL,
        blocked_at TIMESTAMP DEFAULT NOW(),
        blocked_by BIGINT NOT NULL,
        reason TEXT,
        is_active BOOLEAN DEFAULT true,
        CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
      );
    `);

    // Ensure all required columns exist in players table
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);

    // Ensure all required columns exist in economy table
    await pool.query(`
      ALTER TABLE economy 
      ADD COLUMN IF NOT EXISTS player_id INT REFERENCES players(id) ON DELETE CASCADE;
    `);

    // Ensure unique constraints exist for players table
    await pool.query(`
      ALTER TABLE players 
      ADD CONSTRAINT IF NOT EXISTS players_unique_guild_server_discord 
      UNIQUE (guild_id, server_id, discord_id);
    `);

    await pool.query(`
      ALTER TABLE players 
      ADD CONSTRAINT IF NOT EXISTS players_unique_guild_server_ign 
      UNIQUE (guild_id, server_id, ign);
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id);
      CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign);
      CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
      CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id);
      CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id);
      CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id);
      CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status);
      CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at);
      CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id);
      CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign);
      CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active);
    `);

    // Update existing players to be active if is_active is NULL
    await pool.query(`
      UPDATE players SET is_active = true WHERE is_active IS NULL;
    `);

    // Grant permissions to zentro_user (if it exists)
    try {
      await pool.query(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zentro_user;
        GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO zentro_user;
      `);
      console.log('✅ Permissions granted to zentro_user');
    } catch (permError) {
      console.log('⚠️ Could not grant permissions to zentro_user (user may not exist):', permError.message);
    }

    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase
};