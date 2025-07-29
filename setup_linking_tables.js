const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function setupLinkingTables() {
  try {
    console.log('🔧 Setting up linking tables...');
    
    // Create player_links table
    console.log('Creating player_links table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT NOT NULL,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unlinked_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE KEY unique_guild_discord_server (guild_id, discord_id, server_id),
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ player_links table created');

    // Create indexes for player_links
    console.log('Creating indexes for player_links...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_player_links_guild_discord ON player_links(guild_id, discord_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_player_links_guild_ign ON player_links(guild_id, ign(191))');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_player_links_active ON player_links(is_active)');
    console.log('✅ player_links indexes created');

    // Create link_requests table
    console.log('Creating link_requests table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT NOT NULL,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 HOUR),
        UNIQUE KEY unique_guild_discord_server (guild_id, discord_id, server_id),
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ link_requests table created');

    // Create indexes for link_requests
    console.log('Creating indexes for link_requests...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at)');
    console.log('✅ link_requests indexes created');

    // Create link_blocks table
    console.log('Creating link_blocks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT NOT NULL,
        discord_id BIGINT NULL,
        ign TEXT NULL,
        blocked_by BIGINT NOT NULL,
        reason TEXT NULL,
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        CHECK (discord_id IS NOT NULL OR ign IS NOT NULL),
        UNIQUE KEY unique_guild_discord (guild_id, discord_id),
        UNIQUE KEY unique_guild_ign (guild_id, ign(191)),
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ link_blocks table created');

    // Create indexes for link_blocks
    console.log('Creating indexes for link_blocks...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign(191))');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active)');
    console.log('✅ link_blocks indexes created');

    // Migrate existing data
    console.log('Migrating existing player data...');
    await pool.query(`
      INSERT IGNORE INTO player_links (guild_id, discord_id, ign, server_id, linked_at, is_active)
      SELECT p.guild_id, p.discord_id, p.ign, p.server_id, CURRENT_TIMESTAMP, TRUE
      FROM players p
      WHERE p.discord_id IS NOT NULL
    `);
    console.log('✅ Existing data migrated');

    // Clean up expired requests
    console.log('Cleaning up expired requests...');
    await pool.query('DELETE FROM link_requests WHERE expires_at < CURRENT_TIMESTAMP AND status = \'pending\'');
    console.log('✅ Expired requests cleaned up');

    console.log('🎉 All linking tables set up successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error);
  } finally {
    await pool.end();
  }
}

setupLinkingTables(); 