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
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
});

async function migrateToUnifiedSystem() {
  console.log('Starting MySQL migration to unified player system...');
  
  try {
    // Step 1: Backup existing data
    console.log('Step 1: Backing up existing data...');
    
    // Backup old players table
    const [oldPlayers] = await pool.query('SELECT * FROM players');
    console.log(`Found ${oldPlayers.length} players in old system`);
    
    // Check if player_links table exists
    let oldPlayerLinks = [];
    try {
      const [playerLinksResult] = await pool.query('SELECT * FROM player_links');
      oldPlayerLinks = playerLinksResult;
      console.log(`Found ${oldPlayerLinks.length} player links in old system`);
    } catch (error) {
      console.log('No player_links table found - skipping player_links migration');
    }
    
    // Backup old economy table
    const [oldEconomy] = await pool.query('SELECT * FROM economy');
    console.log(`Found ${oldEconomy.length} economy records in old system`);
    
    // Step 2: Create new unified players table
    console.log('Step 2: Creating new unified players table...');
    
    // Drop the old players table and recreate with new structure
    await pool.query('DROP TABLE IF EXISTS players CASCADE');
    
    await pool.query(`
      CREATE TABLE players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id INT,
        server_id VARCHAR(32),
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unlinked_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE KEY unique_guild_server_discord (guild_id, server_id, discord_id),
        UNIQUE KEY unique_guild_server_ign (guild_id, server_id, ign(191))
      )
    `);
    
    // Step 3: Migrate data from old system
    console.log('Step 3: Migrating data...');
    
    // Migrate from old players table
    for (const player of oldPlayers) {
      if (player.discord_id) {
        // Convert discord_id to BIGINT if it's currently VARCHAR
        const discordId = typeof player.discord_id === 'string' ? parseInt(player.discord_id) : player.discord_id;
        
        await pool.query(`
          INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, TRUE)
          ON DUPLICATE KEY UPDATE
            ign = VALUES(ign),
            linked_at = VALUES(linked_at),
            unlinked_at = NULL,
            is_active = TRUE
        `, [player.guild_id, player.server_id, discordId, player.ign]);
      }
    }
    
    // Migrate from old player_links table (if it exists)
    if (oldPlayerLinks.length > 0) {
      for (const link of oldPlayerLinks) {
        if (link.is_active) {
          // Convert discord_id to BIGINT if it's currently VARCHAR
          const discordId = typeof link.discord_id === 'string' ? parseInt(link.discord_id) : link.discord_id;
          
          await pool.query(`
            INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
            VALUES (?, ?, ?, ?, ?, TRUE)
            ON DUPLICATE KEY UPDATE
              ign = VALUES(ign),
              linked_at = VALUES(linked_at),
              unlinked_at = NULL,
              is_active = TRUE
          `, [link.guild_id, link.server_id, discordId, link.ign, link.linked_at]);
        }
      }
    }
    
    // Step 4: Recreate economy table with proper foreign key
    console.log('Step 4: Recreating economy table...');
    
    await pool.query('DROP TABLE IF EXISTS economy');
    
    await pool.query(`
      CREATE TABLE economy (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT,
        balance INT DEFAULT 0,
        UNIQUE KEY unique_player (player_id),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);
    
    // Step 5: Migrate economy data
    console.log('Step 5: Migrating economy data...');
    
    for (const econ of oldEconomy) {
      // Find the corresponding player in the new system
      const [playerResult] = await pool.query(`
        SELECT id FROM players WHERE id = ? AND is_active = TRUE
      `, [econ.player_id]);
      
      if (playerResult.length > 0) {
        await pool.query(`
          INSERT INTO economy (player_id, balance)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE balance = VALUES(balance)
        `, [econ.player_id, econ.balance]);
      }
    }
    
    // Step 6: Create indexes
    console.log('Step 6: Creating indexes...');
    
    await pool.query('CREATE INDEX idx_players_guild_discord ON players(guild_id, discord_id)');
    await pool.query('CREATE INDEX idx_players_guild_ign ON players(guild_id, ign(191))');
    await pool.query('CREATE INDEX idx_players_active ON players(is_active)');
    await pool.query('CREATE INDEX idx_players_server ON players(server_id)');
    await pool.query('CREATE INDEX idx_economy_player ON economy(player_id)');
    
    // Step 7: Clean up old tables (only if they exist)
    console.log('Step 7: Cleaning up old tables...');
    
    try {
      await pool.query('DROP TABLE IF EXISTS player_links');
      console.log('Dropped player_links table');
    } catch (error) {
      console.log('player_links table was already dropped or never existed');
    }
    
    console.log('Migration completed successfully!');
    console.log('New unified system is ready to use.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateToUnifiedSystem()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToUnifiedSystem }; 