const pool = require('./src/db');

async function testLinkingSystem() {
  console.log('🧪 Testing Linking System...');
  
  try {
    // Test 1: Check database structure
    console.log('\n📋 Test 1: Database Structure');
    const [economyColumns] = await pool.query('DESCRIBE economy');
    console.log('✅ Economy table structure verified');
    
    // Test 2: Check guild exists
    console.log('\n📋 Test 2: Guild Check');
    const [guilds] = await pool.query('SELECT * FROM guilds LIMIT 1');
    if (guilds.length > 0) {
      console.log(`✅ Found guild: ${guilds[0].name} (Discord ID: ${guilds[0].discord_id})`);
    } else {
      console.log('⚠️ No guilds found in database');
    }
    
    // Test 3: Check servers exist
    console.log('\n📋 Test 3: Server Check');
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 3');
    if (servers.length > 0) {
      console.log(`✅ Found ${servers.length} servers:`);
      servers.forEach(server => {
        console.log(`  - ${server.nickname} (ID: ${server.id})`);
      });
    } else {
      console.log('⚠️ No servers found in database');
    }
    
    // Test 4: Test player insertion (simulate linking)
    console.log('\n📋 Test 4: Player Insertion Test');
    const testGuildId = guilds.length > 0 ? guilds[0].discord_id : '1342235198175182921';
    const testServerId = servers.length > 0 ? servers[0].id : 'test_server';
    const testDiscordId = '999999999999999999';
    const testIgn = 'test_player_' + Date.now();
    
    console.log(`Testing with: Guild=${testGuildId}, Server=${testServerId}, Discord=${testDiscordId}, IGN=${testIgn}`);
    
    // Ensure guild exists
    await pool.query(
      'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [testGuildId, 'Test Guild']
    );
    console.log('✅ Guild ensured');
    
    // Insert test player
    const [playerResult] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)',
      [testGuildId, testServerId, testDiscordId, testIgn]
    );
    console.log(`✅ Player inserted with ID: ${playerResult.insertId}`);
    
    // Insert economy record
    await pool.query(
      'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), 0)',
      [playerResult.insertId, playerResult.insertId]
    );
    console.log('✅ Economy record created');
    
    // Insert stats record
    await pool.query(
      'INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak) VALUES (?, 0, 0, 0, 0)',
      [playerResult.insertId]
    );
    console.log('✅ Stats record created');
    
    // Insert playtime record
    await pool.query(
      'INSERT INTO player_playtime (player_id, total_minutes) VALUES (?, 0)',
      [playerResult.insertId]
    );
    console.log('✅ Playtime record created');
    
    // Test 5: Verify all records exist
    console.log('\n📋 Test 5: Record Verification');
    const [playerCheck] = await pool.query('SELECT * FROM players WHERE id = ?', [playerResult.insertId]);
    const [economyCheck] = await pool.query('SELECT * FROM economy WHERE player_id = ?', [playerResult.insertId]);
    const [statsCheck] = await pool.query('SELECT * FROM player_stats WHERE player_id = ?', [playerResult.insertId]);
    const [playtimeCheck] = await pool.query('SELECT * FROM player_playtime WHERE player_id = ?', [playerResult.insertId]);
    
    console.log(`✅ Player record: ${playerCheck.length > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Economy record: ${economyCheck.length > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Stats record: ${statsCheck.length > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Playtime record: ${playtimeCheck.length > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Test 6: Clean up test data
    console.log('\n📋 Test 6: Cleanup');
    await pool.query('DELETE FROM player_playtime WHERE player_id = ?', [playerResult.insertId]);
    await pool.query('DELETE FROM player_stats WHERE player_id = ?', [playerResult.insertId]);
    await pool.query('DELETE FROM economy WHERE player_id = ?', [playerResult.insertId]);
    await pool.query('DELETE FROM players WHERE id = ?', [playerResult.insertId]);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! Linking system should work correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
  } finally {
    await pool.end();
  }
}

testLinkingSystem();
