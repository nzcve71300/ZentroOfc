const pool = require('./src/db');

async function migrateToUnifiedSystem() {
  console.log('Starting migration to unified player system...');
  
  try {
    // Step 1: Backup existing data
    console.log('Step 1: Backing up existing data...');
    
    // Backup old players table
    const oldPlayers = await pool.query('SELECT * FROM players');
    console.log(`Found ${oldPlayers.rows.length} players in old system`);
    
    // Backup old player_links table
    const oldPlayerLinks = await pool.query('SELECT * FROM player_links');
    console.log(`Found ${oldPlayerLinks.rows.length} player links in old system`);
    
    // Backup old economy table
    const oldEconomy = await pool.query('SELECT * FROM economy');
    console.log(`Found ${oldEconomy.rows.length} economy records in old system`);
    
    // Step 2: Create new unified players table
    console.log('Step 2: Creating new unified players table...');
    
    // Drop the old players table and recreate with new structure
    await pool.query('DROP TABLE IF EXISTS players CASCADE');
    
    await pool.query(`
      CREATE TABLE players (
        id SERIAL PRIMARY KEY,
        guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
        server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
        discord_id BIGINT NOT NULL,
        ign TEXT NOT NULL,
        linked_at TIMESTAMP DEFAULT NOW(),
        unlinked_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(guild_id, discord_id, server_id)
      )
    `);
    
    // Step 3: Migrate data from old system
    console.log('Step 3: Migrating data...');
    
    // Migrate from old players table
    for (const player of oldPlayers.rows) {
      if (player.discord_id) {
        // Convert discord_id to BIGINT if it's currently VARCHAR
        const discordId = typeof player.discord_id === 'string' ? parseInt(player.discord_id) : player.discord_id;
        
        await pool.query(`
          INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
          VALUES ($1, $2, $3, $4, NOW(), true)
          ON CONFLICT (guild_id, discord_id, server_id) DO NOTHING
        `, [player.guild_id, player.server_id, discordId, player.ign]);
      }
    }
    
    // Migrate from old player_links table
    for (const link of oldPlayerLinks.rows) {
      if (link.is_active) {
        // Convert discord_id to BIGINT if it's currently VARCHAR
        const discordId = typeof link.discord_id === 'string' ? parseInt(link.discord_id) : link.discord_id;
        
        await pool.query(`
          INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (guild_id, discord_id, server_id) 
          DO UPDATE SET 
            ign = EXCLUDED.ign,
            linked_at = EXCLUDED.linked_at,
            unlinked_at = NULL,
            is_active = true
        `, [link.guild_id, link.server_id, discordId, link.ign, link.linked_at]);
      }
    }
    
    // Step 4: Recreate economy table with proper foreign key
    console.log('Step 4: Recreating economy table...');
    
    await pool.query('DROP TABLE IF EXISTS economy CASCADE');
    
    await pool.query(`
      CREATE TABLE economy (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players(id) ON DELETE CASCADE,
        balance INT DEFAULT 0,
        UNIQUE(player_id)
      )
    `);
    
    // Step 5: Migrate economy data
    console.log('Step 5: Migrating economy data...');
    
    for (const econ of oldEconomy.rows) {
      // Find the corresponding player in the new system
      const playerResult = await pool.query(`
        SELECT id FROM players WHERE id = $1 AND is_active = true
      `, [econ.player_id]);
      
      if (playerResult.rows.length > 0) {
        await pool.query(`
          INSERT INTO economy (player_id, balance)
          VALUES ($1, $2)
          ON CONFLICT (player_id) DO UPDATE SET balance = EXCLUDED.balance
        `, [econ.player_id, econ.balance]);
      }
    }
    
    // Step 6: Create indexes
    console.log('Step 6: Creating indexes...');
    
    await pool.query('CREATE INDEX idx_players_guild_discord ON players(guild_id, discord_id)');
    await pool.query('CREATE INDEX idx_players_guild_ign ON players(guild_id, ign)');
    await pool.query('CREATE INDEX idx_players_active ON players(is_active)');
    await pool.query('CREATE INDEX idx_players_server ON players(server_id)');
    await pool.query('CREATE INDEX idx_economy_player ON economy(player_id)');
    
    // Step 7: Clean up old tables
    console.log('Step 7: Cleaning up old tables...');
    
    await pool.query('DROP TABLE IF EXISTS player_links CASCADE');
    
    console.log('Migration completed successfully!');
    console.log('New unified system is ready to use.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
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