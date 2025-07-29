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

async function addConstraintIfNotExists(table, constraintName, constraintSQL) {
  try {
    // Check if constraint exists
    const [constraints] = await pool.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
    `, [process.env.DB_NAME, table, constraintName]);
    
    if (constraints.length === 0) {
      await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} ${constraintSQL}`);
      console.log(`✅ Added constraint ${constraintName} to ${table}`);
    } else {
      console.log(`ℹ️ Constraint ${constraintName} already exists on ${table}`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not add constraint ${constraintName} to ${table}:`, error.message);
  }
}

async function migrate() {
  console.log('Starting MySQL migration...');

  try {
    /** ------------------------
     * PLAYERS TABLE
     ------------------------ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id BIGINT,
        server_id BIGINT,
        discord_id BIGINT,
        ign TEXT,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unlinked_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    await addConstraintIfNotExists(
      'players',
      'players_unique_guild_server_discord',
      'UNIQUE (guild_id, server_id, discord_id)'
    );
    await addConstraintIfNotExists(
      'players',
      'players_unique_guild_server_ign',
      'UNIQUE (guild_id, server_id, ign(191))'
    );

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign(191))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id)`);

    /** ------------------------
     * ECONOMY TABLE
     ------------------------ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economy (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT,
        balance INT DEFAULT 0,
        UNIQUE KEY unique_player (player_id),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id)`);

    /** ------------------------
     * TRANSACTIONS TABLE
     ------------------------ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT,
        amount INT NOT NULL,
        type TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);

    /** ------------------------
     * LINK REQUESTS TABLE
     ------------------------ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id BIGINT NOT NULL,
        server_id BIGINT NOT NULL,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 10 MINUTE),
        status TEXT DEFAULT 'pending'
      )
    `);
    await addConstraintIfNotExists(
      'link_requests',
      'link_requests_unique_guild_server_discord',
      'UNIQUE (guild_id, server_id, discord_id)'
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at)`);

    /** ------------------------
     * LINK BLOCKS TABLE
     ------------------------ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS link_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id BIGINT NOT NULL,
        discord_id BIGINT NULL,
        ign TEXT NULL,
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        blocked_by BIGINT NOT NULL,
        reason TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        CHECK ((discord_id IS NOT NULL AND ign IS NULL) OR (discord_id IS NULL AND ign IS NOT NULL))
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign(191))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active)`);

    /** ------------------------
     * PLAYER LINKS TABLE
     ------------------------ */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id BIGINT NOT NULL,
        server_id BIGINT NOT NULL,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unlinked_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    await addConstraintIfNotExists(
      'player_links',
      'player_links_unique_guild_server_discord',
      'UNIQUE (guild_id, server_id, discord_id)'
    );
    await addConstraintIfNotExists(
      'player_links',
      'player_links_unique_guild_server_ign',
      'UNIQUE (guild_id, server_id, ign(191))'
    );

    /** ------------------------
     * EVENT CONFIGS TABLE
     ------------------------ */
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

    /** ------------------------
     * PERMISSIONS
     ------------------------ */
    // MySQL permissions are typically handled at the user level
    console.log('ℹ️ MySQL permissions should be configured at the user level');

    console.log('✅ Migration complete!');
    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    throw error;
  }
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  // process.exit(1); // Removed so the bot still runs even if migrations fail
}); 