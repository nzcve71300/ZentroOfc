const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPlayerLookupUnified() {
  console.log('🔧 Fixing Player Lookup System (Unified)');
  console.log('========================================\n');

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
    const serverName = 'USA-DeadOps';
    const playerName = 'nzcve7130';

    console.log(`\n📋 Step 1: Checking current database structure...`);
    
    // Check what tables exist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📊 Available tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });

    console.log(`\n📋 Step 2: Checking current player lookup...`);
    
    // Check how the bot currently looks up players using the unified system
    const [currentLookup] = await connection.execute(
      `SELECT p.*, rs.nickname as server_name
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND rs.nickname = ?
       AND p.is_active = true`,
      [guildId, serverName]
    );

    console.log(`📊 Current lookup method found ${currentLookup.length} players`);
    if (currentLookup.length > 0) {
      currentLookup.forEach((player, index) => {
        console.log(`  ${index + 1}. Player: ${player.ign}`);
        console.log(`     Server: ${player.server_name}`);
        console.log(`     Server ID: ${player.server_id}`);
        console.log(`     Discord ID: ${player.discord_id}`);
        console.log(`     Guild ID: ${player.guild_id}`);
        console.log(`     Active: ${player.is_active}`);
      });
    }

    console.log(`\n📋 Step 3: Checking economy records...`);
    
    // Check economy records for these players
    if (currentLookup.length > 0) {
      for (const player of currentLookup) {
        const [economyResult] = await connection.execute(
          'SELECT * FROM economy WHERE player_id = ?',
          [player.id]
        );
        
        if (economyResult.length > 0) {
          console.log(`  ✅ Player ${player.ign} has economy record: ${economyResult[0].balance} balance`);
        } else {
          console.log(`  ❌ Player ${player.ign} has NO economy record`);
        }
      }
    }

    console.log(`\n📋 Step 4: Testing specific player lookup...`);
    
    // Test looking up a specific player by Discord ID and server
    const [specificPlayer] = await connection.execute(
      `SELECT p.*, rs.nickname as server_name, e.balance
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       LEFT JOIN economy e ON p.id = e.player_id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND p.discord_id = ?
       AND rs.nickname = ?
       AND p.is_active = true`,
      [guildId, '609', serverName] // 609 is nzcve7130's discord_id
    );

    console.log(`📊 Specific player lookup found ${specificPlayer.length} players`);
    if (specificPlayer.length > 0) {
      specificPlayer.forEach((player, index) => {
        console.log(`  ${index + 1}. Player: ${player.ign}`);
        console.log(`     Server: ${player.server_name}`);
        console.log(`     Server ID: ${player.server_id}`);
        console.log(`     Discord ID: ${player.discord_id}`);
        console.log(`     Balance: ${player.balance || 0}`);
      });
    }

    console.log(`\n📋 Step 5: Creating improved stored procedure...`);
    
    // Create a better stored procedure for player lookup
    try {
      await connection.execute(`
        DROP PROCEDURE IF EXISTS GetPlayerByDiscordAndServer;
        
        CREATE PROCEDURE GetPlayerByDiscordAndServer(
          IN p_guild_discord_id VARCHAR(20),
          IN p_discord_id VARCHAR(20),
          IN p_server_name VARCHAR(255)
        )
        BEGIN
          DECLARE v_guild_id INT;
          DECLARE v_server_id VARCHAR(32);
          
          -- Get guild ID
          SELECT id INTO v_guild_id FROM guilds WHERE discord_id = p_guild_discord_id;
          
          -- Get server ID
          SELECT id INTO v_server_id FROM rust_servers WHERE guild_id = v_guild_id AND nickname = p_server_name;
          
          -- Find player with economy info
          SELECT 
            p.*,
            rs.nickname as server_name,
            COALESCE(e.balance, 0) as balance,
            'unified' as source
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          LEFT JOIN economy e ON p.id = e.player_id
          WHERE p.guild_id = v_guild_id
          AND p.discord_id = p_discord_id
          AND p.server_id = v_server_id
          AND p.is_active = true;
        END
      `);
      
      console.log('✅ Created improved GetPlayerByDiscordAndServer stored procedure');
    } catch (error) {
      console.log(`⚠️  Could not create stored procedure: ${error.message}`);
    }

    console.log(`\n📋 Step 6: Testing the improved stored procedure...`);
    
    // Test the improved stored procedure
    try {
      const [procedureResult] = await connection.execute(
        'CALL GetPlayerByDiscordAndServer(?, ?, ?)',
        [guildId, '609', serverName]
      );
      
      console.log(`📊 Improved stored procedure found ${procedureResult.length} players`);
      if (procedureResult.length > 0) {
        procedureResult.forEach((player, index) => {
          console.log(`  ${index + 1}. Player: ${player.ign}`);
          console.log(`     Server: ${player.server_name}`);
          console.log(`     Server ID: ${player.server_id}`);
          console.log(`     Discord ID: ${player.discord_id}`);
          console.log(`     Balance: ${player.balance}`);
          console.log(`     Source: ${player.source}`);
        });
      }
    } catch (error) {
      console.log(`⚠️  Could not test stored procedure: ${error.message}`);
    }

    console.log(`\n📋 Step 7: Checking for missing economy records...`);
    
    // Find players without economy records
    const [missingEconomy] = await connection.execute(
      `SELECT p.id, p.ign, rs.nickname as server_name
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       LEFT JOIN economy e ON p.id = e.player_id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND p.is_active = true
       AND e.player_id IS NULL`,
      [guildId]
    );

    console.log(`📊 Found ${missingEconomy.length} players without economy records`);
    if (missingEconomy.length > 0) {
      console.log('Players missing economy records:');
      missingEconomy.forEach(player => {
        console.log(`  - ${player.ign} on ${player.server_name}`);
      });
    }

    console.log('\n🎉 Player Lookup System Analysis Complete!');
    console.log('\n📊 Summary:');
    console.log(`  - Current lookup method: ${currentLookup.length} players found`);
    console.log(`  - Specific player lookup: ${specificPlayer.length} players found`);
    console.log(`  - Players missing economy: ${missingEconomy.length}`);
    
    console.log('\n📝 Next steps:');
    console.log('1. The bot is already using the unified system correctly');
    console.log('2. Check if players are properly linked with /link command');
    console.log('3. Economy records should be created automatically when linking');
    console.log('4. Test with: /balance server: USA-DeadOps');
    console.log('5. If issues persist, check the linking process');

  } catch (error) {
    console.error('❌ Error fixing player lookup:', error);
  } finally {
    await connection.end();
    process.exit();
  }
}

// Run the script
fixPlayerLookupUnified();
