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
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 10 MINUTE),
        status TEXT DEFAULT 'pending',
        UNIQUE KEY unique_guild_discord_server (guild_id, discord_id, server_id)
      )
    `);

    // Ensure link_blocks table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT NOT NULL,
        discord_id BIGINT NULL,
        ign TEXT NULL,
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        blocked_by BIGINT NOT NULL,
        reason TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
      )
    `);

    // Ensure all required columns exist in players table
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMP NULL
    `);
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
    `);

    // Ensure all required columns exist in economy table
    await pool.query(`
      ALTER TABLE economy 
      ADD COLUMN IF NOT EXISTS player_id INT
    `);

    // Add foreign key constraint if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE economy 
        ADD CONSTRAINT fk_economy_player 
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      `);
    } catch (error) {
      // Check for various MySQL constraint already exists errors
      if (!error.message.includes('Duplicate key name') && 
          !error.message.includes('Duplicate key on write or update') &&
          !error.message.includes('Duplicate entry') &&
          !error.message.includes('already exists')) {
        throw error;
      }
      // Constraint already exists, ignore
      console.log('ℹ️ Foreign key constraint fk_economy_player already exists');
    }

    // Ensure unique constraints exist for players table
    try {
      await pool.query(`
        ALTER TABLE players 
        ADD CONSTRAINT players_unique_guild_server_discord 
        UNIQUE (guild_id, server_id, discord_id)
      `);
    } catch (error) {
      // Check for various MySQL constraint already exists errors
      if (!error.message.includes('Duplicate key name') && 
          !error.message.includes('Duplicate key on write or update') &&
          !error.message.includes('Duplicate entry') &&
          !error.message.includes('already exists')) {
        throw error;
      }
      // Constraint already exists, ignore
      console.log('ℹ️ Unique constraint players_unique_guild_server_discord already exists');
    }

    try {
      await pool.query(`
        ALTER TABLE players 
        ADD CONSTRAINT players_unique_guild_server_ign 
        UNIQUE (guild_id, server_id, ign(191))
      `);
    } catch (error) {
      // Check for various MySQL constraint already exists errors
      if (!error.message.includes('Duplicate key name') && 
          !error.message.includes('Duplicate key on write or update') &&
          !error.message.includes('Duplicate entry') &&
          !error.message.includes('already exists')) {
        throw error;
      }
      // Constraint already exists, ignore
      console.log('ℹ️ Unique constraint players_unique_guild_server_ign already exists');
    }

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign(191))
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign(191))
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active)
    `);

    // Update existing players to be active if is_active is NULL
    await pool.query(`
      UPDATE players SET is_active = TRUE WHERE is_active IS NULL
    `);

    // Ensure event_configs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32),
        event_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        kill_message TEXT,
        respawn_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_event (server_id, event_type(191)),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);

    // Note: MySQL permissions are user-level, not schema-level like PostgreSQL
    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase
};