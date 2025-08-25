const mysql = require('mysql2/promise');
require('dotenv').config();

async function testUnlinkCommand() {
  console.log('🧪 Testing Unlink Command and Related Functionality');
  console.log('==================================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Test 1: Check database structure
    console.log('\n📋 Test 1: Database Structure Check');
    console.log('─'.repeat(50));
    
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('players', 'rust_servers', 'guilds', 'kit_auth')
      ORDER BY TABLE_NAME
    `, [process.env.DB_NAME]);
    
    console.log('Required tables found:');
    tables.forEach(table => {
      console.log(`  ✅ ${table.TABLE_NAME}`);
    });

    // Test 2: Check players table structure
    console.log('\n📋 Test 2: Players Table Structure');
    console.log('─'.repeat(50));
    
    const [playerColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME]);
    
    console.log('Players table columns:');
    playerColumns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    // Test 3: Find active players for testing
    console.log('\n📋 Test 3: Find Active Players for Testing');
    console.log('─'.repeat(50));
    
    const [activePlayers] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.is_active,
        rs.nickname as server_name,
        g.name as guild_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.is_active = true
      ORDER BY p.ign
      LIMIT 10
    `);
    
    if (activePlayers.length === 0) {
      console.log('❌ No active players found for testing');
      console.log('💡 You need to have some linked players to test the unlink command');
    } else {
      console.log(`Found ${activePlayers.length} active players for testing:`);
      activePlayers.forEach((player, index) => {
        console.log(`  ${index + 1}. ${player.ign} (Discord: ${player.discord_id || 'Not linked'}) - ${player.server_name} - ${player.guild_name}`);
      });
    }

    // Test 4: Test Discord ID normalization
    console.log('\n📋 Test 4: Discord ID Normalization Test');
    console.log('─'.repeat(50));
    
    const testDiscordIds = [
      '123456789012345678',
      '1234567890123456789',
      '12345678901234567890',
      'invalid_id',
      ''
    ];
    
    testDiscordIds.forEach(id => {
      const isNumeric = /^\d+$/.test(id);
      console.log(`  "${id}": ${isNumeric ? '✅ Valid Discord ID' : '❌ Invalid Discord ID'}`);
    });

    // Test 5: Test IGN normalization
    console.log('\n📋 Test 5: IGN Normalization Test');
    console.log('─'.repeat(50));
    
    const testIgns = [
      'PlayerName',
      'player_name',
      'PLAYERNAME',
      'Player Name',
      'player123',
      ''
    ];
    
    testIgns.forEach(ign => {
      const isValid = ign && ign.length >= 2;
      console.log(`  "${ign}": ${isValid ? '✅ Valid IGN' : '❌ Invalid IGN'}`);
    });

    // Test 6: Check kit_auth entries
    console.log('\n📋 Test 6: Kit Authorization Check');
    console.log('─'.repeat(50));
    
    const [kitAuth] = await connection.execute(`
      SELECT 
        ka.discord_id,
        ka.kitlist,
        rs.nickname as server_name,
        COUNT(*) as auth_count
      FROM kit_auth ka
      JOIN rust_servers rs ON ka.server_id = rs.id
      GROUP BY ka.discord_id, ka.kitlist, rs.nickname
      ORDER BY auth_count DESC
      LIMIT 5
    `);
    
    if (kitAuth.length === 0) {
      console.log('❌ No kit authorization entries found');
    } else {
      console.log('Top kit authorization entries:');
      kitAuth.forEach(auth => {
        console.log(`  Discord ID: ${auth.discord_id} - Kit: ${auth.kitlist} - Server: ${auth.server_name} (${auth.auth_count} entries)`);
      });
    }

    // Test 7: Simulate unlink query (read-only)
    console.log('\n📋 Test 7: Simulate Unlink Query (Read-only)');
    console.log('─'.repeat(50));
    
    if (activePlayers.length > 0) {
      const testPlayer = activePlayers[0];
      console.log(`Testing unlink query for: ${testPlayer.ign}`);
      
      // Test by IGN
      const [ignQuery] = await connection.execute(`
        SELECT p.*, rs.nickname, g.name as guild_name
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        JOIN guilds g ON p.guild_id = g.id
        WHERE LOWER(p.ign) = LOWER(?) 
        AND p.is_active = true
      `, [testPlayer.ign]);
      
      console.log(`  IGN query found ${ignQuery.length} players`);
      
      // Test by Discord ID (if available)
      if (testPlayer.discord_id) {
        const [discordQuery] = await connection.execute(`
          SELECT p.*, rs.nickname, g.name as guild_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON p.guild_id = g.id
          WHERE p.discord_id = ? 
          AND p.is_active = true
        `, [testPlayer.discord_id]);
        
        console.log(`  Discord ID query found ${discordQuery.length} players`);
      }
    }

    // Test 8: Check for potential issues
    console.log('\n📋 Test 8: Potential Issues Check');
    console.log('─'.repeat(50));
    
    // Check for players with null IGN
    const [nullIgnPlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE ign IS NULL OR ign = ''
    `);
    
    if (nullIgnPlayers[0].count > 0) {
      console.log(`⚠️  Found ${nullIgnPlayers[0].count} players with null/empty IGN`);
    } else {
      console.log('✅ No players with null/empty IGN found');
    }
    
    // Check for duplicate active players
    const [duplicatePlayers] = await connection.execute(`
      SELECT ign, COUNT(*) as count
      FROM players 
      WHERE is_active = true 
      GROUP BY ign 
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (duplicatePlayers.length > 0) {
      console.log('⚠️  Found duplicate active players:');
      duplicatePlayers.forEach(dup => {
        console.log(`  ${dup.ign}: ${dup.count} entries`);
      });
    } else {
      console.log('✅ No duplicate active players found');
    }

    console.log('\n📋 Test Summary');
    console.log('─'.repeat(50));
    console.log('✅ Database connection: Working');
    console.log(`✅ Required tables: ${tables.length}/4 found`);
    console.log(`✅ Active players: ${activePlayers.length} available for testing`);
    console.log(`✅ Kit auth entries: ${kitAuth.length} found`);
    
    if (activePlayers.length > 0) {
      console.log('\n💡 To test the unlink command:');
      console.log(`   Use: /unlink name:${activePlayers[0].ign}`);
      if (activePlayers[0].discord_id) {
        console.log(`   Or: /unlink name:${activePlayers[0].discord_id}`);
      }
    }

    await connection.end();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the test
testUnlinkCommand();
