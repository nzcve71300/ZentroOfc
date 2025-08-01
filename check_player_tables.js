const pool = require('./src/db');

async function checkPlayerTables() {
  try {
    console.log('🔍 Checking player-related tables...');
    
    // Check what tables exist
    const [tables] = await pool.query('SHOW TABLES');
    console.log('📋 All tables in database:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    // Check if players table exists
    const [playersTable] = await pool.query('SHOW TABLES LIKE "players"');
    if (playersTable.length > 0) {
      console.log('\n✅ Players table exists');
      
      // Check table structure
      const [structure] = await pool.query('DESCRIBE players');
      console.log('📋 Players table structure:');
      structure.forEach(row => {
        console.log(`   ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
      });
      
      // Check for any player data
      const [playerCount] = await pool.query('SELECT COUNT(*) as count FROM players');
      console.log(`📊 Total players in database: ${playerCount[0].count}`);
      
      if (playerCount[0].count > 0) {
        const [samplePlayers] = await pool.query('SELECT * FROM players LIMIT 3');
        console.log('📋 Sample player records:');
        samplePlayers.forEach(player => {
          console.log(`   Guild ID: ${player.guild_id}, Discord ID: ${player.discord_id}, IGN: ${player.ign}, Active: ${player.is_active}`);
        });
      }
    } else {
      console.log('❌ Players table does not exist');
    }
    
    // Check if guilds table exists
    const [guildsTable] = await pool.query('SHOW TABLES LIKE "guilds"');
    if (guildsTable.length > 0) {
      console.log('\n✅ Guilds table exists');
      
      // Check table structure
      const [structure] = await pool.query('DESCRIBE guilds');
      console.log('📋 Guilds table structure:');
      structure.forEach(row => {
        console.log(`   ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
      });
      
      // Check for any guild data
      const [guildCount] = await pool.query('SELECT COUNT(*) as count FROM guilds');
      console.log(`📊 Total guilds in database: ${guildCount[0].count}`);
      
      if (guildCount[0].count > 0) {
        const [sampleGuilds] = await pool.query('SELECT * FROM guilds LIMIT 3');
        console.log('📋 Sample guild records:');
        sampleGuilds.forEach(guild => {
          console.log(`   ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
        });
      }
    } else {
      console.log('❌ Guilds table does not exist');
    }
    
    // Check if rust_servers table exists
    const [serversTable] = await pool.query('SHOW TABLES LIKE "rust_servers"');
    if (serversTable.length > 0) {
      console.log('\n✅ Rust servers table exists');
      
      // Check for any server data
      const [serverCount] = await pool.query('SELECT COUNT(*) as count FROM rust_servers');
      console.log(`📊 Total servers in database: ${serverCount[0].count}`);
      
      if (serverCount[0].count > 0) {
        const [sampleServers] = await pool.query('SELECT * FROM rust_servers LIMIT 3');
        console.log('📋 Sample server records:');
        sampleServers.forEach(server => {
          console.log(`   ID: ${server.id}, Guild ID: ${server.guild_id}, Nickname: ${server.nickname}`);
        });
      }
    } else {
      console.log('❌ Rust servers table does not exist');
    }
    
    // Check if economy table exists
    const [economyTable] = await pool.query('SHOW TABLES LIKE "economy"');
    if (economyTable.length > 0) {
      console.log('\n✅ Economy table exists');
      
      // Check for any economy data
      const [economyCount] = await pool.query('SELECT COUNT(*) as count FROM economy');
      console.log(`📊 Total economy records: ${economyCount[0].count}`);
    } else {
      console.log('❌ Economy table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error checking player tables:', error);
  } finally {
    await pool.end();
  }
}

checkPlayerTables(); 