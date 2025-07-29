const pool = require('./src/db');

async function migrateToUnifiedSystemSafe() {
  console.log('Starting safe migration to unified player system...');
  
  try {
    // Step 1: Backup existing data
    console.log('Step 1: Backing up existing data...');
    
    // Backup old players table
    const oldPlayers = await pool.query('SELECT * FROM players');
    console.log(`Found ${oldPlayers.rows.length} players in old system`);
    
    // Check if player_links table exists
    let oldPlayerLinks = { rows: [] };
    try {
      oldPlayerLinks = await pool.query('SELECT * FROM player_links');
      console.log(`Found ${oldPlayerLinks.rows.length} player links in old system`);
    } catch (error) {
      console.log('No player_links table found - skipping player_links migration');
    }
    
    // Backup old economy table
    const oldEconomy = await pool.query('SELECT * FROM economy');
    console.log(`Found ${oldEconomy.rows.length} economy records in old system`);
    
    // Step 2: Create new unified players table (without dropping old one)
    console.log('Step 2: Creating new unified players table...');
    
    // Create new table with different name
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players_new (
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
          INSERT INTO players_new (guild_id, server_id, discord_id, ign, linked_at, is_active)
          VALUES ($1, $2, $3, $4, NOW(), true)
          ON CONFLICT (guild_id, discord_id, server_id) DO NOTHING
        `, [player.guild_id, player.server_id, discordId, player.ign]);
      }
    }
    
    // Migrate from old player_links table (if it exists)
    if (oldPlayerLinks.rows.length > 0) {
      for (const link of oldPlayerLinks.rows) {
        if (link.is_active) {
          // Convert discord_id to BIGINT if it's currently VARCHAR
          const discordId = typeof link.discord_id === 'string' ? parseInt(link.discord_id) : link.discord_id;
          
          await pool.query(`
            INSERT INTO players_new (guild_id, server_id, discord_id, ign, linked_at, is_active)
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
    }
    
    // Step 4: Create new economy table with proper foreign key
    console.log('Step 4: Creating new economy table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economy_new (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players_new(id) ON DELETE CASCADE,
        balance INT DEFAULT 0,
        UNIQUE(player_id)
      )
    `);
    
    // Step 5: Migrate economy data
    console.log('Step 5: Migrating economy data...');
    
    for (const econ of oldEconomy.rows) {
      // Find the corresponding player in the new system
      const playerResult = await pool.query(`
        SELECT id FROM players_new WHERE id = $1 AND is_active = true
      `, [econ.player_id]);
      
      if (playerResult.rows.length > 0) {
        await pool.query(`
          INSERT INTO economy_new (player_id, balance)
          VALUES ($1, $2)
          ON CONFLICT (player_id) DO UPDATE SET balance = EXCLUDED.balance
        `, [econ.player_id, econ.balance]);
      }
    }
    
    // Step 6: Create indexes
    console.log('Step 6: Creating indexes...');
    
    await pool.query('CREATE INDEX IF NOT EXISTS idx_players_new_guild_discord ON players_new(guild_id, discord_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_players_new_guild_ign ON players_new(guild_id, ign)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_players_new_active ON players_new(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_players_new_server ON players_new(server_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_economy_new_player ON economy_new(player_id)');
    
    console.log('Safe migration completed successfully!');
    console.log('New tables created: players_new, economy_new');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test the new system with the updated commands');
    console.log('2. If everything works, you can manually rename tables:');
    console.log('   - ALTER TABLE players RENAME TO players_old;');
    console.log('   - ALTER TABLE players_new RENAME TO players;');
    console.log('   - ALTER TABLE economy RENAME TO economy_old;');
    console.log('   - ALTER TABLE economy_new RENAME TO economy;');
    console.log('3. Update your database connection to use the new tables');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateToUnifiedSystemSafe()
    .then(() => {
      console.log('Safe migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Safe migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToUnifiedSystemSafe };