const mysql = require('mysql2/promise');
require('dotenv').config();

async function transferPlayersToNewServer() {
  console.log('🔄 Transferring Players to New Server');
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

    console.log(`\n📋 Step 1: Finding source server "${sourceServerName}"...`);
    
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

    console.log(`\n📋 Step 2: Finding target server "${targetServerName}"...`);
    
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

    console.log(`\n📋 Step 3: Transferring players from ${sourceServerName} to ${targetServerName}...`);
    
    // Get all players from source server
    const [sourcePlayers] = await connection.execute(
      'SELECT id, guild_id, discord_id, ign, is_active FROM players WHERE server_id = ?',
      [sourceServerId]
    );

    console.log(`📊 Found ${sourcePlayers.length} players on source server`);

    if (sourcePlayers.length === 0) {
      console.log('❌ No players found on source server to transfer');
      return;
    }

    let transferredCount = 0;
    let skippedCount = 0;

    for (const player of sourcePlayers) {
      try {
        // Check if player already exists on target server
        const [existingPlayer] = await connection.execute(
          'SELECT id FROM players WHERE server_id = ? AND ign = ?',
          [targetServerId, player.ign]
        );

        if (existingPlayer.length > 0) {
          console.log(`  ⏭️  Skipping ${player.ign} (already exists on target server)`);
          skippedCount++;
          continue;
        }

        // Insert player on target server
        await connection.execute(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, is_active) VALUES (?, ?, ?, ?, ?)',
          [player.guild_id, targetServerId, player.discord_id, player.ign, player.is_active]
        );

        console.log(`  ✅ Transferred ${player.ign}`);
        transferredCount++;

      } catch (error) {
        console.log(`  ❌ Failed to transfer ${player.ign}: ${error.message}`);
      }
    }

    console.log(`\n📋 Step 4: Transferring economy balances...`);
    
    // Get economy records from source server
    const [sourceEconomy] = await connection.execute(
      'SELECT player_id, balance FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
      [sourceServerId]
    );

    console.log(`📊 Found ${sourceEconomy.length} economy records to transfer`);

    let economyTransferred = 0;

    for (const econRecord of sourceEconomy) {
      try {
        // Get the corresponding player ID on target server
        const [targetPlayer] = await connection.execute(
          'SELECT id FROM players WHERE server_id = ? AND discord_id = (SELECT discord_id FROM players WHERE id = ?)',
          [targetServerId, econRecord.player_id]
        );

        if (targetPlayer.length > 0) {
          const targetPlayerId = targetPlayer[0].id;
          
          // Check if economy record already exists
          const [existingEcon] = await connection.execute(
            'SELECT id FROM economy WHERE player_id = ?',
            [targetPlayerId]
          );

          if (existingEcon.length === 0) {
            // Create economy record with same balance
            await connection.execute(
              'INSERT INTO economy (player_id, balance) VALUES (?, ?)',
              [targetPlayerId, econRecord.balance]
            );
            console.log(`  ✅ Economy transferred for player ID ${targetPlayerId} (${econRecord.balance} balance)`);
            economyTransferred++;
          } else {
            console.log(`  ⏭️  Economy record already exists for player ID ${targetPlayerId}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed to transfer economy for player ID ${econRecord.player_id}: ${error.message}`);
      }
    }

    console.log(`\n📋 Step 5: Transferring player stats...`);
    
    // Get player stats from source server - check what columns exist first
    try {
      const [columns] = await connection.execute(
        'SHOW COLUMNS FROM player_stats'
      );
      
      const availableColumns = columns.map(col => col.Field);
      console.log(`📊 Available columns in player_stats: ${availableColumns.join(', ')}`);
      
      // Build dynamic query based on available columns
      const selectColumns = [];
      if (availableColumns.includes('player_id')) selectColumns.push('player_id');
      if (availableColumns.includes('kills')) selectColumns.push('kills');
      if (availableColumns.includes('deaths')) selectColumns.push('deaths');
      if (availableColumns.includes('kill_streak')) selectColumns.push('kill_streak');
      if (availableColumns.includes('highest_streak')) selectColumns.push('highest_streak');
      if (availableColumns.includes('last_kill_time')) selectColumns.push('last_kill_time');
      if (availableColumns.includes('last_death_time')) selectColumns.push('last_death_time');
      
      if (selectColumns.length === 0) {
        console.log('  ⚠️  No valid columns found in player_stats table, skipping stats transfer');
      } else {
        const selectQuery = `SELECT ${selectColumns.join(', ')} FROM player_stats WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)`;
        const [sourceStats] = await connection.execute(selectQuery, [sourceServerId]);
        
        console.log(`📊 Found ${sourceStats.length} player stats records to transfer`);
        
        let statsTransferred = 0;
        
        for (const statRecord of sourceStats) {
          try {
            // Get the corresponding player ID on target server
            const [targetPlayer] = await connection.execute(
              'SELECT id FROM players WHERE server_id = ? AND discord_id = (SELECT discord_id FROM players WHERE server_id = ? AND id = ?)',
              [targetServerId, sourceServerId, statRecord.player_id]
            );
            
            if (targetPlayer.length > 0) {
              const targetPlayerId = targetPlayer[0].id;
              
              // Check if stats record already exists
              const [existingStats] = await connection.execute(
                'SELECT id FROM player_stats WHERE player_id = ?',
                [targetPlayerId]
              );
              
              if (existingStats.length === 0) {
                // Build dynamic INSERT query
                const insertColumns = selectColumns.filter(col => col !== 'player_id');
                const placeholders = insertColumns.map(() => '?').join(', ');
                const insertQuery = `INSERT INTO player_stats (player_id, ${insertColumns.join(', ')}) VALUES (?, ${placeholders})`;
                
                const insertValues = [targetPlayerId, ...insertColumns.map(col => statRecord[col])];
                
                await connection.execute(insertQuery, insertValues);
                console.log(`  ✅ Stats transferred for player ID ${targetPlayerId}`);
                statsTransferred++;
              } else {
                console.log(`  ⏭️  Stats record already exists for player ID ${targetPlayerId}`);
              }
            }
          } catch (error) {
            console.log(`  ❌ Failed to transfer stats for player ID ${statRecord.player_id}: ${error.message}`);
          }
        }
        
        console.log(`  📊 Stats transfer completed: ${statsTransferred} records transferred`);
      }
    } catch (error) {
      console.log(`  ⚠️  Player stats table not found or error: ${error.message}`);
    }

    console.log(`\n📋 Step 6: Copying server configurations...`);
    
    // Copy eco_games_config
    try {
      const [sourceEcoConfig] = await connection.execute(
        'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ?',
        [sourceServerId]
      );

      console.log(`📊 Found ${sourceEcoConfig.length} eco config records to copy`);

      for (const config of sourceEcoConfig) {
        try {
          // Check if config already exists
          const [existingConfig] = await connection.execute(
            'SELECT id FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
            [targetServerId, config.setting_name]
          );

          if (existingConfig.length === 0) {
            await connection.execute(
              'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?)',
              [targetServerId, config.setting_name, config.setting_value]
            );
            console.log(`  ✅ Eco config copied: ${config.setting_name}`);
          } else {
            console.log(`  ⏭️  Eco config already exists: ${config.setting_name}`);
          }
        } catch (error) {
          console.log(`  ❌ Failed to copy eco config ${config.setting_name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Eco config table not found or error: ${error.message}`);
    }

    // Copy crate_event_configs
    try {
      const [sourceCrateConfig] = await connection.execute(
        'SELECT crate_type, enabled, spawn_interval_minutes, spawn_amount, spawn_message FROM crate_event_configs WHERE server_id = ?',
        [sourceServerId]
      );

      console.log(`📊 Found ${sourceCrateConfig.length} crate config records to copy`);

      for (const config of sourceCrateConfig) {
        try {
          // Check if config already exists
          const [existingConfig] = await connection.execute(
            'SELECT id FROM crate_event_configs WHERE server_id = ? AND crate_type = ?',
            [targetServerId, config.crate_type]
          );

          if (existingConfig.length === 0) {
            await connection.execute(
              'INSERT INTO crate_event_configs (server_id, crate_type, enabled, spawn_interval_minutes, spawn_amount, spawn_message) VALUES (?, ?, ?, ?, ?, ?)',
              [targetServerId, config.crate_type, config.enabled, config.spawn_interval_minutes, config.spawn_amount, config.spawn_message]
            );
            console.log(`  ✅ Crate config copied: ${config.crate_type}`);
          } else {
            console.log(`  ⏭️  Crate config already exists: ${config.crate_type}`);
          }
        } catch (error) {
          console.log(`  ❌ Failed to copy crate config ${config.crate_type}: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Crate config table not found or error: ${error.message}`);
    }

    console.log('\n🎉 Player Transfer Completed Successfully!');
    console.log('\n📊 Transfer Summary:');
    console.log(`  - Players transferred: ${transferredCount}`);
    console.log(`  - Players skipped (already existed): ${skippedCount}`);
    console.log(`  - Economy records transferred: ${economyTransferred}`);
    console.log(`  - Stats records transferred: ${statsTransferred}`);
    console.log(`  - Total players processed: ${sourcePlayers.length}`);
    
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test the new server: /balance server: USA-DeadOps');
    console.log('3. All players should now work on the new server!');

  } catch (error) {
    console.error('❌ Error transferring players:', error);
  } finally {
    process.exit();
  }
}

// Run the script
transferPlayersToNewServer();
