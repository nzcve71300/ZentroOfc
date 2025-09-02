const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMultiServerPlayers() {
  console.log('🔧 Fixing Multi-Server Player Linking');
  console.log('=====================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const guildId = '1387187628469653555';
    const sourceServerName = 'Dead-ops';
    const targetServerName = 'USA-DeadOps';

    console.log(`\n📋 Step 1: Finding servers...`);
    
    // Find source server
    const [sourceServer] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, sourceServerName]
    );

    if (sourceServer.length === 0) {
      console.log(`❌ Source server "${sourceServerName}" not found!`);
      return;
    }

    const sourceServerId = sourceServer[0].id;
    console.log(`✅ Found source server: ID ${sourceServerId}, Name: "${sourceServer[0].nickname}"`);

    // Find target server
    const [targetServer] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, targetServerName]
    );

    if (targetServer.length === 0) {
      console.log(`❌ Target server "${targetServerName}" not found!`);
      return;
    }

    const targetServerId = targetServer[0].id;
    console.log(`✅ Found target server: ID ${targetServerId}, Name: "${targetServer[0].nickname}"`);

    console.log(`\n📋 Step 2: Checking current database structure...`);
    
    // Check the structure of existing tables to understand data types
    console.log('📋 Checking players table structure...');
    const [playerColumns] = await connection.execute('SHOW COLUMNS FROM players');
    console.log('Players table columns:', playerColumns.map(col => `${col.Field}: ${col.Type}`));
    
    console.log('📋 Checking rust_servers table structure...');
    const [serverColumns] = await connection.execute('SHOW COLUMNS FROM rust_servers');
    console.log('Rust_servers table columns:', serverColumns.map(col => `${col.Field}: ${col.Type}`));
    
    console.log('📋 Checking guilds table structure...');
    const [guildColumns] = await connection.execute('SHOW COLUMNS FROM guilds');
    console.log('Guilds table columns:', guildColumns.map(col => `${col.Field}: ${col.Type}`));
    
    // Check if player_server_links table exists
    const [tables] = await connection.execute('SHOW TABLES LIKE "player_server_links"');
    
    if (tables.length === 0) {
      console.log('📋 Creating player_server_links table...');
      
      // Get the actual data types from the referenced tables
      const playerIdType = playerColumns.find(col => col.Field === 'id')?.Type || 'INT';
      const serverIdType = serverColumns.find(col => col.Field === 'id')?.Type || 'VARCHAR(255)';
      const guildIdType = guildColumns.find(col => col.Field === 'id')?.Type || 'INT';
      
      console.log(`📊 Using data types: player_id=${playerIdType}, server_id=${serverIdType}, guild_id=${guildIdType}`);
      
      await connection.execute(`
        CREATE TABLE player_server_links (
          id INT AUTO_INCREMENT PRIMARY KEY,
          player_id ${playerIdType} NOT NULL,
          server_id ${serverIdType} NOT NULL,
          guild_id ${guildIdType} NOT NULL,
          discord_id VARCHAR(255) NOT NULL,
          ign VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_player_server (player_id, server_id),
          UNIQUE KEY unique_ign_server_guild (ign, server_id, guild_id)
        )
      `);
      
      console.log('✅ Created player_server_links table (without foreign keys for now)');
    } else {
      console.log('✅ player_server_links table already exists');
    }

    console.log(`\n📋 Step 3: Getting all players from source server...`);
    
    // Get all players from source server
    const [sourcePlayers] = await connection.execute(
      'SELECT id, guild_id, discord_id, ign, is_active FROM players WHERE server_id = ?',
      [sourceServerId]
    );

    console.log(`📊 Found ${sourcePlayers.length} players on source server`);

    if (sourcePlayers.length === 0) {
      console.log('❌ No players found on source server');
      return;
    }

    console.log(`\n📋 Step 4: Creating player links for new server...`);
    
    let linksCreated = 0;
    let linksSkipped = 0;

    for (const player of sourcePlayers) {
      try {
        // Check if link already exists
        const [existingLink] = await connection.execute(
          'SELECT id FROM player_server_links WHERE player_id = ? AND server_id = ?',
          [player.id, targetServerId]
        );

        if (existingLink.length > 0) {
          console.log(`  ⏭️  Skipping ${player.ign} (link already exists)`);
          linksSkipped++;
          continue;
        }

        // Create link to new server
        await connection.execute(
          'INSERT INTO player_server_links (player_id, server_id, guild_id, discord_id, ign, is_active) VALUES (?, ?, ?, ?, ?, ?)',
          [player.id, targetServerId, player.guild_id, player.discord_id, player.ign, player.is_active]
        );

        console.log(`  ✅ Created link for ${player.ign} to ${targetServerName}`);
        linksCreated++;

      } catch (error) {
        console.log(`  ❌ Failed to create link for ${player.ign}: ${error.message}`);
      }
    }

    console.log(`\n📋 Step 5: Copying economy balances...`);
    
    // Get economy records from source server
    const [sourceEconomy] = await connection.execute(
      'SELECT player_id, balance FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
      [sourceServerId]
    );

    console.log(`📊 Found ${sourceEconomy.length} economy records to copy`);

    let economyCopied = 0;

    for (const econRecord of sourceEconomy) {
      try {
        // Check if economy record already exists for this player on target server
        const [existingEcon] = await connection.execute(
          'SELECT id FROM economy WHERE player_id = ?',
          [econRecord.player_id]
        );

        if (existingEcon.length === 0) {
          // Create economy record with same balance
          await connection.execute(
            'INSERT INTO economy (player_id, balance) VALUES (?, ?)',
            [econRecord.player_id, econRecord.balance]
          );
          console.log(`  ✅ Economy copied for player ID ${econRecord.player_id} (${econRecord.balance} balance)`);
          economyCopied++;
        } else {
          console.log(`  ⏭️  Economy record already exists for player ID ${econRecord.player_id}`);
        }
      } catch (error) {
        console.log(`  ❌ Failed to copy economy for player ID ${econRecord.player_id}: ${error.message}`);
      }
    }

    console.log(`\n📋 Step 6: Copying player stats...`);
    
    // Get player stats from source server
    const [sourceStats] = await connection.execute(
      'SELECT player_id, kills, deaths, kill_streak, highest_streak, last_kill_time FROM player_stats WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
      [sourceServerId]
    );

    console.log(`📊 Found ${sourceStats.length} player stats records to copy`);

    let statsCopied = 0;

    for (const statRecord of sourceStats) {
      try {
        // Check if stats record already exists for this player
        const [existingStats] = await connection.execute(
          'SELECT id FROM player_stats WHERE player_id = ?',
          [statRecord.player_id]
        );

        if (existingStats.length === 0) {
          // Create stats record
          await connection.execute(
            'INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak, last_kill_time) VALUES (?, ?, ?, ?, ?, ?)',
            [statRecord.player_id, statRecord.kills, statRecord.deaths, statRecord.kill_streak, statRecord.highest_streak, statRecord.last_kill_time]
          );
          console.log(`  ✅ Stats copied for player ID ${statRecord.player_id}`);
          statsCopied++;
        } else {
          console.log(`  ⏭️  Stats record already exists for player ID ${statRecord.player_id}`);
        }
      } catch (error) {
        console.log(`  ❌ Failed to copy stats for player ID ${statRecord.player_id}: ${error.message}`);
      }
    }

    console.log('\n🎉 Multi-Server Player Linking Completed Successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Player links created: ${linksCreated}`);
    console.log(`  - Player links skipped: ${linksSkipped}`);
    console.log(`  - Economy records copied: ${economyCopied}`);
    console.log(`  - Stats records copied: ${statsCopied}`);
    console.log(`  - Total players processed: ${sourcePlayers.length}`);
    
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test the new server: /balance server: USA-DeadOps');
    console.log('3. All players should now work on both servers!');
    console.log('\n💡 Note: Players are now linked to both servers via the player_server_links table');

  } catch (error) {
    console.error('❌ Error fixing multi-server players:', error);
  } finally {
    process.exit();
  }
}

// Run the script
fixMultiServerPlayers();
