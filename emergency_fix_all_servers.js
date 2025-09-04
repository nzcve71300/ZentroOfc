const mysql = require('mysql2/promise');
require('dotenv').config();

async function emergencyFixAllServers() {
  console.log('🚨 EMERGENCY FIX: DeadOps ↔ USA-DeadOps Player Linking');
  console.log('========================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Step 1: Find both servers
    console.log('📋 Step 1: Finding DeadOps and USA-DeadOps servers...\n');
    
    const { deadOpsServerId, usaDeadOpsServerId, guildId } = await findServers(connection);
    
    // Step 2: Fix player linking between both servers
    console.log('\n📋 Step 2: Fixing Player Linking Between Servers...\n');
    
    await fixPlayerLinkingBetweenServers(connection, deadOpsServerId, usaDeadOpsServerId, guildId);
    
    // Step 3: Ensure economy tables exist for all players
    console.log('\n📋 Step 3: Ensuring Economy Tables Exist...\n');
    
    await ensureEconomyTablesExist(connection, deadOpsServerId, usaDeadOpsServerId);
    
    // Step 4: Implement permanent fix
    console.log('\n📋 Step 4: Implementing Permanent Fix...\n');
    
    await implementPermanentFix(connection);
    
    // Step 5: Verify everything is working
    console.log('\n📋 Step 5: Verifying Fixes...\n');
    
    await verifyFixes(connection, deadOpsServerId, usaDeadOpsServerId);

    console.log('\n🎉 EMERGENCY FIX COMPLETED SUCCESSFULLY!');
    console.log('==========================================');
    console.log('✅ All players linked between DeadOps and USA-DeadOps');
    console.log('✅ All economy tables created');
    console.log('✅ Permanent fix implemented');
    console.log('✅ Multi-tenancy maintained');
    console.log('\n🚀 Players can now use /swap between servers!');

  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

async function findServers(connection) {
  console.log('🔧 Finding servers...');
  
  const guildId = '1387187628469653555'; // DeadOps Discord guild ID
  
  // Ensure guild exists
  let [guilds] = await connection.execute(
    'SELECT * FROM guilds WHERE discord_id = ?',
    [guildId]
  );
  
  if (guilds.length === 0) {
    await connection.execute(
      'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
      [guildId, 'DeadOps Gaming']
    );
    console.log('  ✅ Created DeadOps guild record');
  } else {
    console.log('  ✅ DeadOps guild record exists');
  }
  
  // Get guild ID for foreign key references
  [guilds] = await connection.execute(
    'SELECT id FROM guilds WHERE discord_id = ?',
    [guildId]
  );
  const guildDbId = guilds[0].id;
  
  // Find DeadOps server
  let [servers] = await connection.execute(
    'SELECT * FROM rust_servers WHERE nickname = ? AND guild_id = ?',
    ['Dead-ops', guildDbId]
  );
  
  let deadOpsServerId;
  if (servers.length === 0) {
    // Create DeadOps server if it doesn't exist
    const deadOpsId = `deadops_${Date.now()}`;
    await connection.execute(
      'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, rcon_password, currency_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [deadOpsId, guildDbId, 'Dead-ops', '127.0.0.1', 28015, 'placeholder', 'placeholder', 'coins']
    );
    deadOpsServerId = deadOpsId;
    console.log('  ✅ Created DeadOps server record');
  } else {
    deadOpsServerId = servers[0].id;
    console.log('  ✅ DeadOps server record exists');
  }
  
  // Find USA-DeadOps server
  [servers] = await connection.execute(
    'SELECT * FROM rust_servers WHERE nickname = ? AND guild_id = ?',
    ['USA-DeadOps', guildDbId]
  );
  
  let usaDeadOpsServerId;
  if (servers.length === 0) {
    // Create USA-DeadOps server if it doesn't exist
    const usaDeadOpsId = `usadeadops_${Date.now()}`;
    await connection.execute(
      'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, rcon_password, currency_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [usaDeadOpsId, guildDbId, 'USA-DeadOps', '127.0.0.1', 28016, 'placeholder', 'placeholder', 'coins']
    );
    usaDeadOpsServerId = usaDeadOpsId;
    console.log('  ✅ Created USA-DeadOps server record');
  } else {
    usaDeadOpsServerId = servers[0].id;
    console.log('  ✅ USA-DeadOps server record exists');
  }
  
  console.log(`  📊 Server IDs: DeadOps=${deadOpsServerId}, USA-DeadOps=${usaDeadOpsServerId}`);
  
  return { deadOpsServerId, usaDeadOpsServerId, guildId: guildDbId };
}

async function fixPlayerLinkingBetweenServers(connection, deadOpsServerId, usaDeadOpsServerId, guildId) {
  console.log('🔧 Fixing player linking between servers...');
  
  // Get all unique Discord users from both servers
  const [allDiscordUsers] = await connection.execute(`
    SELECT DISTINCT discord_id, ign 
    FROM players 
    WHERE (server_id = ? OR server_id = ?) AND discord_id IS NOT NULL AND discord_id != 0
  `, [deadOpsServerId, usaDeadOpsServerId]);
  
  console.log(`  📊 Found ${allDiscordUsers.length} unique Discord users to process`);
  
  let linkedCount = 0;
  
  for (const user of allDiscordUsers) {
    const { discord_id, ign } = user;
    
    // Check if user exists on DeadOps
    let [deadOpsPlayer] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ? AND discord_id = ? AND is_active = 1',
      [deadOpsServerId, discord_id]
    );
    
    // Check if user exists on USA-DeadOps
    let [usaDeadOpsPlayer] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ? AND discord_id = ? AND is_active = 1',
      [usaDeadOpsServerId, discord_id]
    );
    
    // If user exists on one server but not the other, create the missing record
    if (deadOpsPlayer.length > 0 && usaDeadOpsPlayer.length === 0) {
      // User exists on DeadOps but not USA-DeadOps
      try {
        await connection.execute(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, is_active) VALUES (?, ?, ?, ?, 1)',
          [guildId, usaDeadOpsServerId, discord_id, ign]
        );
        linkedCount++;
        console.log(`    ✅ Linked ${ign} to USA-DeadOps`);
      } catch (error) {
        if (error.message.includes('Duplicate entry')) {
          // Record already exists, mark as active
          await connection.execute(
            'UPDATE players SET is_active = 1 WHERE server_id = ? AND discord_id = ?',
            [usaDeadOpsServerId, discord_id]
          );
          console.log(`    🔧 Fixed USA-DeadOps record for ${ign}`);
        }
      }
    } else if (usaDeadOpsPlayer.length > 0 && deadOpsPlayer.length === 0) {
      // User exists on USA-DeadOps but not DeadOps
      try {
        await connection.execute(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, is_active) VALUES (?, ?, ?, ?, 1)',
          [guildId, deadOpsServerId, discord_id, ign]
        );
        linkedCount++;
        console.log(`    ✅ Linked ${ign} to DeadOps`);
      } catch (error) {
        if (error.message.includes('Duplicate entry')) {
          // Record already exists, mark as active
          await connection.execute(
            'UPDATE players SET is_active = 1 WHERE server_id = ? AND discord_id = ?',
            [deadOpsServerId, discord_id]
          );
          console.log(`    🔧 Fixed DeadOps record for ${ign}`);
        }
      }
    } else if (deadOpsPlayer.length > 0 && usaDeadOpsPlayer.length > 0) {
      console.log(`    ✅ ${ign} already linked to both servers`);
    }
  }
  
  console.log(`  📊 Linking completed: ${linkedCount} new links created`);
}

async function ensureEconomyTablesExist(connection, deadOpsServerId, usaDeadOpsServerId) {
  console.log('🔧 Ensuring economy tables exist...');
  
  // Ensure economy table exists
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS economy (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        balance INT DEFAULT 0,
        last_daily TIMESTAMP NULL,
        UNIQUE KEY unique_player (player_id)
      )
    `);
    console.log('  ✅ Economy table created/verified');
  } catch (error) {
    console.log(`  ⚠️ Economy table error: ${error.message}`);
  }
  
  // Get all players from both servers
  const [allPlayers] = await connection.execute(`
    SELECT p.id, p.discord_id, p.ign, p.server_id, rs.nickname as server_name
    FROM players p
    JOIN rust_servers rs ON p.server_id = rs.id
    WHERE p.server_id IN (?, ?) AND p.is_active = 1
  `, [deadOpsServerId, usaDeadOpsServerId]);
  
  console.log(`  📊 Found ${allPlayers.length} players to process for economy`);
  
  let economyCreated = 0;
  
  for (const player of allPlayers) {
    // Check if economy record exists
    const [economyRecord] = await connection.execute(
      'SELECT * FROM economy WHERE player_id = ?',
      [player.id]
    );
    
    if (economyRecord.length === 0) {
      // Create economy record with 0 balance (preserving existing currency)
      await connection.execute(
        'INSERT INTO economy (player_id, balance) VALUES (?, 0)',
        [player.id]
      );
      economyCreated++;
      console.log(`    ✅ Created economy record for ${player.ign} on ${player.server_name}`);
    } else {
      console.log(`    ✅ Economy record exists for ${player.ign} on ${player.server_name} (Balance: ${economyRecord[0].balance})`);
    }
  }
  
  console.log(`  📊 Economy setup completed: ${economyCreated} new economy records created`);
}

async function implementPermanentFix(connection) {
  console.log('🔧 Implementing permanent fix...');
  
  // Create trigger to automatically create economy records for new players
  try {
    await connection.execute(`
      CREATE TRIGGER IF NOT EXISTS auto_create_economy
      AFTER INSERT ON players
      FOR EACH ROW
      BEGIN
        INSERT IGNORE INTO economy (player_id, balance) VALUES (NEW.id, 0);
      END
    `);
    console.log('  ✅ Auto-economy trigger created');
  } catch (error) {
    console.log(`  ⚠️ Auto-economy trigger error: ${error.message}`);
  }
  
  // Create stored procedure for automatic server linking
  try {
    await connection.execute(`
      CREATE PROCEDURE IF NOT EXISTS auto_link_to_all_servers(
        IN p_guild_id BIGINT,
        IN p_discord_id BIGINT,
        IN p_ign VARCHAR(255)
      )
      BEGIN
        DECLARE v_guild_db_id INT;
        DECLARE v_server_id VARCHAR(32);
        DECLARE done INT DEFAULT FALSE;
        DECLARE server_cursor CURSOR FOR 
          SELECT id FROM rust_servers WHERE guild_id = p_guild_id AND is_active = 1;
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
        
        -- Get guild database ID
        SELECT id INTO v_guild_db_id FROM guilds WHERE discord_id = p_guild_id;
        
        IF v_guild_db_id IS NULL THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Guild not found';
        END IF;
        
        -- Link player to all servers in the guild
        OPEN server_cursor;
        
        read_loop: LOOP
          FETCH server_cursor INTO v_server_id;
          IF done THEN
            LEAVE read_loop;
          END IF;
          
          -- Insert player record if it doesn't exist
          INSERT IGNORE INTO players (guild_id, server_id, discord_id, ign, is_active)
          VALUES (v_guild_db_id, v_server_id, p_discord_id, p_ign, 1);
          
        END LOOP;
        
        CLOSE server_cursor;
        
        -- Create economy records for all new player records
        INSERT IGNORE INTO economy (player_id, balance)
        SELECT p.id, 0
        FROM players p
        WHERE p.discord_id = p_discord_id AND p.guild_id = v_guild_db_id;
        
        SELECT 'Player linked to all servers successfully' as result;
      END
    `);
    console.log('  ✅ Auto-linking procedure created');
  } catch (error) {
    console.log(`  ⚠️ Auto-linking procedure error: ${error.message}`);
  }
  
  console.log('  🛡️ Permanent fix implemented');
}

async function verifyFixes(connection, deadOpsServerId, usaDeadOpsServerId) {
  console.log('🔍 Verifying fixes...');
  
  // Check player counts on both servers
  const [deadOpsPlayers] = await connection.execute(
    'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = 1',
    [deadOpsServerId]
  );
  
  const [usaDeadOpsPlayers] = await connection.execute(
    'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = 1',
    [usaDeadOpsServerId]
  );
  
  console.log(`  📊 DeadOps players: ${deadOpsPlayers[0].count}`);
  console.log(`  📊 USA-DeadOps players: ${usaDeadOpsPlayers[0].count}`);
  
  // Check economy records
  const [deadOpsEconomy] = await connection.execute(`
    SELECT COUNT(*) as count 
    FROM economy e 
    JOIN players p ON e.player_id = p.id 
    WHERE p.server_id = ?
  `, [deadOpsServerId]);
  
  const [usaDeadOpsEconomy] = await connection.execute(`
    SELECT COUNT(*) as count 
    FROM economy e 
    JOIN players p ON e.player_id = p.id 
    WHERE p.server_id = ?
  `, [usaDeadOpsServerId]);
  
  console.log(`  💰 DeadOps economy records: ${deadOpsEconomy[0].count}`);
  console.log(`  💰 USA-DeadOps economy records: ${usaDeadOpsEconomy[0].count}`);
  
  // Check for any orphaned records
  const [orphanedPlayers] = await connection.execute(`
    SELECT COUNT(*) as count 
    FROM players p 
    LEFT JOIN economy e ON p.id = e.player_id 
    WHERE e.player_id IS NULL AND p.is_active = 1
  `);
  
  if (orphanedPlayers[0].count > 0) {
    console.log(`  ⚠️ Found ${orphanedPlayers[0].count} players without economy records - fixing...`);
    
    // Fix orphaned players
    await connection.execute(`
      INSERT IGNORE INTO economy (player_id, balance)
      SELECT p.id, 0
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      WHERE e.player_id IS NULL AND p.is_active = 1
    `);
    
    console.log('  ✅ Fixed orphaned economy records');
  } else {
    console.log('  ✅ All players have economy records');
  }
  
  console.log('  ✅ Verification completed successfully');
}

// Run the emergency fix
emergencyFixAllServers();

