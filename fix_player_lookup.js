const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPlayerLookup() {
  console.log('🔧 Fixing Player Lookup System');
  console.log('================================\n');

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

    console.log(`\n📋 Step 1: Checking current player lookup...`);
    
    // Check how the bot currently looks up players
    const [currentLookup] = await connection.execute(
      `SELECT p.*, rs.nickname as server_name
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND p.discord_id = ?
       AND rs.nickname = ?
       AND p.is_active = true`,
      [guildId, '609', serverName] // 609 is nzcve7130's discord_id
    );

    console.log(`📊 Current lookup method found ${currentLookup.length} players`);
    if (currentLookup.length > 0) {
      console.log(`  - Player: ${currentLookup[0].ign}`);
      console.log(`  - Server: ${currentLookup[0].server_name}`);
      console.log(`  - Server ID: ${currentLookup[0].server_id}`);
    }

    console.log(`\n📋 Step 2: Checking new player_server_links table...`);
    
    // Check the new linking table
    const [linkLookup] = await connection.execute(
      `SELECT psl.*, rs.nickname as server_name
       FROM player_server_links psl
       JOIN rust_servers rs ON psl.server_id = rs.id
       WHERE psl.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND psl.discord_id = ?
       AND rs.nickname = ?
       AND psl.is_active = true`,
      [guildId, '609', serverName]
    );

    console.log(`📊 New lookup method found ${linkLookup.length} players`);
    if (linkLookup.length > 0) {
      console.log(`  - Player: ${linkLookup[0].ign}`);
      console.log(`  - Server: ${linkLookup[0].server_name}`);
      console.log(`  - Server ID: ${linkLookup[0].server_id}`);
    }

    console.log(`\n📋 Step 3: Creating a view to bridge old and new systems...`);
    
    // Create a view that combines both tables for backward compatibility
    try {
      await connection.execute(`
        CREATE OR REPLACE VIEW players_unified AS
        SELECT 
          p.id,
          p.guild_id,
          p.server_id,
          p.discord_id,
          p.ign,
          p.linked_at,
          p.unlinked_at,
          p.is_active,
          rs.nickname as server_name
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        
        UNION ALL
        
        SELECT 
          psl.player_id as id,
          psl.guild_id,
          psl.server_id,
          psl.discord_id,
          psl.ign,
          psl.created_at as linked_at,
          NULL as unlinked_at,
          psl.is_active,
          rs.nickname as server_name
        FROM player_server_links psl
        JOIN rust_servers rs ON psl.server_id = rs.id
        WHERE psl.player_id NOT IN (
          SELECT p2.id FROM players p2 WHERE p2.discord_id = psl.discord_id AND p2.server_id = psl.server_id
        )
      `);
      
      console.log('✅ Created players_unified view');
    } catch (error) {
      console.log(`⚠️  Could not create view: ${error.message}`);
    }

    console.log(`\n📋 Step 4: Testing unified lookup...`);
    
    // Test the unified lookup
    const [unifiedLookup] = await connection.execute(
      `SELECT * FROM players_unified
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND discord_id = ?
       AND server_name = ?
       AND is_active = true`,
      [guildId, '609', serverName]
    );

    console.log(`📊 Unified lookup found ${unifiedLookup.length} players`);
    if (unifiedLookup.length > 0) {
      console.log(`  - Player: ${unifiedLookup[0].ign}`);
      console.log(`  - Server: ${unifiedLookup[0].server_name}`);
      console.log(`  - Server ID: ${unifiedLookup[0].server_id}`);
      console.log(`  - Source: ${unifiedLookup[0].id ? 'players table' : 'player_server_links table'}`);
    }

    console.log(`\n📋 Step 5: Creating a stored procedure for player lookup...`);
    
    // Create a stored procedure for consistent player lookup
    try {
      await connection.execute(`
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
          
          -- Try to find player in main players table first
          SELECT 
            p.*, rs.nickname as server_name, 'main' as source
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          WHERE p.guild_id = v_guild_id
          AND p.discord_id = p_discord_id
          AND p.server_id = v_server_id
          AND p.is_active = true
          
          UNION ALL
          
          -- If not found, try player_server_links table
          SELECT 
            psl.player_id as id,
            psl.guild_id,
            psl.server_id,
            psl.discord_id,
            psl.ign,
            psl.created_at as linked_at,
            NULL as unlinked_at,
            psl.is_active,
            rs.nickname as server_name,
            'link' as source
          FROM player_server_links psl
          JOIN rust_servers rs ON psl.server_id = rs.id
          WHERE psl.guild_id = v_guild_id
          AND psl.discord_id = p_discord_id
          AND psl.server_id = v_server_id
          AND psl.is_active = true
          AND psl.player_id NOT IN (
            SELECT p2.id FROM players p2 WHERE p2.discord_id = psl.discord_id AND p2.server_id = psl.server_id
          );
        END
      `);
      
      console.log('✅ Created GetPlayerByDiscordAndServer stored procedure');
    } catch (error) {
      console.log(`⚠️  Could not create stored procedure: ${error.message}`);
    }

    console.log(`\n📋 Step 6: Testing the stored procedure...`);
    
    // Test the stored procedure
    try {
      const [procedureResult] = await connection.execute(
        'CALL GetPlayerByDiscordAndServer(?, ?, ?)',
        [guildId, '609', serverName]
      );
      
      console.log(`📊 Stored procedure found ${procedureResult.length} players`);
      if (procedureResult.length > 0) {
        console.log(`  - Player: ${procedureResult[0].ign}`);
        console.log(`  - Server: ${procedureResult[0].server_name}`);
        console.log(`  - Server ID: ${procedureResult[0].server_id}`);
        console.log(`  - Source: ${procedureResult[0].source}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not test stored procedure: ${error.message}`);
    }

    console.log('\n🎉 Player Lookup System Analysis Complete!');
    console.log('\n📊 Summary:');
    console.log(`  - Current lookup method: ${currentLookup.length} players found`);
    console.log(`  - New linking method: ${linkLookup.length} players found`);
    console.log(`  - Unified lookup: ${unifiedLookup.length} players found`);
    
    console.log('\n📝 Next steps:');
    console.log('1. The bot needs to be updated to use the new lookup methods');
    console.log('2. Update player lookup functions to check both tables');
    console.log('3. Or use the new players_unified view for backward compatibility');
    console.log('4. Test with: /balance server: USA-DeadOps');

  } catch (error) {
    console.error('❌ Error fixing player lookup:', error);
  } finally {
    process.exit();
  }
}

// Run the script
fixPlayerLookup();
