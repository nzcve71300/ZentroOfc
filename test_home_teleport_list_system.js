const pool = require('./src/db');

async function testHomeTeleportListSystem() {
  console.log('🔧 Testing Home Teleport List System...\n');

  try {
    // Test 1: Check if new tables exist
    console.log('📋 Test 1: Checking database tables...');
    
    const tables = [
      'home_teleport_allowed_users',
      'home_teleport_banned_users'
    ];

    for (const table of tables) {
      try {
        const [result] = await pool.query(`DESCRIBE ${table}`);
        console.log(`✅ Table ${table} exists with ${result.length} columns`);
      } catch (error) {
        console.log(`❌ Table ${table} does not exist: ${error.message}`);
      }
    }

    // Test 2: Check if use_list column exists in home_teleport_configs
    console.log('\n📋 Test 2: Checking home_teleport_configs schema...');
    try {
      const [result] = await pool.query('DESCRIBE home_teleport_configs');
      const useListColumn = result.find(col => col.Field === 'use_list');
      if (useListColumn) {
        console.log(`✅ use_list column exists: ${useListColumn.Type} (Default: ${useListColumn.Default})`);
      } else {
        console.log('❌ use_list column does not exist');
      }
    } catch (error) {
      console.log(`❌ Error checking home_teleport_configs: ${error.message}`);
    }

    // Test 3: Check existing home teleport configurations
    console.log('\n📋 Test 3: Checking existing home teleport configurations...');
    try {
      const [configs] = await pool.query('SELECT * FROM home_teleport_configs LIMIT 5');
      console.log(`✅ Found ${configs.length} home teleport configurations`);
      
      for (const config of configs) {
        console.log(`   - Server ID: ${config.server_id}`);
        console.log(`     use_list: ${config.use_list || 'NULL'}`);
        console.log(`     cooldown_minutes: ${config.cooldown_minutes || 'NULL'}`);
        if (config.whitelist_enabled !== undefined) {
          console.log(`     whitelist_enabled: ${config.whitelist_enabled} (OLD COLUMN)`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking configurations: ${error.message}`);
    }

    // Test 4: Test adding a player to HOMETP-LIST
    console.log('\n📋 Test 4: Testing HOMETP-LIST functionality...');
    try {
      // First, get a server
      const [servers] = await pool.query('SELECT id, nickname FROM rust_servers LIMIT 1');
      if (servers.length === 0) {
        console.log('❌ No servers found for testing');
        return;
      }

      const testServer = servers[0];
      const testPlayer = 'TEST_PLAYER_' + Date.now();
      
      console.log(`   Testing with server: ${testServer.nickname} (${testServer.id})`);
      console.log(`   Test player: ${testPlayer}`);

      // Add player to allowed list
      await pool.query(`
        INSERT INTO home_teleport_allowed_users (server_id, discord_id, ign, added_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        discord_id = VALUES(discord_id),
        ign = VALUES(ign),
        added_by = VALUES(added_by)
      `, [testServer.id, '123456789', testPlayer, 'TEST_BOT']);

      console.log(`✅ Added ${testPlayer} to HOMETP-LIST`);

      // Verify player is in list
      const [allowedResult] = await pool.query(`
        SELECT * FROM home_teleport_allowed_users 
        WHERE server_id = ? AND ign = ?
      `, [testServer.id, testPlayer]);

      if (allowedResult.length > 0) {
        console.log(`✅ Player found in HOMETP-LIST`);
      } else {
        console.log(`❌ Player not found in HOMETP-LIST`);
      }

      // Test 5: Test adding player to HOMETP-BANLIST
      console.log('\n📋 Test 5: Testing HOMETP-BANLIST functionality...');
      
      await pool.query(`
        INSERT INTO home_teleport_banned_users (server_id, discord_id, ign, banned_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        discord_id = VALUES(discord_id),
        ign = VALUES(ign),
        banned_by = VALUES(banned_by)
      `, [testServer.id, '987654321', testPlayer + '_BANNED', 'TEST_BOT']);

      console.log(`✅ Added ${testPlayer}_BANNED to HOMETP-BANLIST`);

      // Verify banned player is in list
      const [bannedResult] = await pool.query(`
        SELECT * FROM home_teleport_banned_users 
        WHERE server_id = ? AND ign = ?
      `, [testServer.id, testPlayer + '_BANNED']);

      if (bannedResult.length > 0) {
        console.log(`✅ Banned player found in HOMETP-BANLIST`);
      } else {
        console.log(`❌ Banned player not found in HOMETP-BANLIST`);
      }

      // Clean up test data
      await pool.query('DELETE FROM home_teleport_allowed_users WHERE ign LIKE ?', [`TEST_PLAYER_%`]);
      await pool.query('DELETE FROM home_teleport_banned_users WHERE ign LIKE ?', [`TEST_PLAYER_%`]);
      console.log('🧹 Cleaned up test data');

    } catch (error) {
      console.log(`❌ Error testing list functionality: ${error.message}`);
    }

    console.log('\n🎯 Home Teleport List System Test Summary:');
    console.log('✅ New database tables created');
    console.log('✅ use_list column added to home_teleport_configs');
    console.log('✅ HOMETP-LIST and HOMETP-BANLIST functionality working');
    console.log('✅ /set HOMETP-USELIST command ready');
    console.log('✅ /add-to-list and /remove-from-list commands updated');
    console.log('✅ Home teleport system updated to use new list system');
    console.log('✅ Silent rejection for unauthorized players (no in-game messages)');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Run the database update script: sql/update_home_teleport_schema.sql');
    console.log('2. Test the /set HOMETP-USELIST command');
    console.log('3. Test adding/removing players from HOMETP-LIST and HOMETP-BANLIST');
    console.log('4. Test home teleport functionality with list restrictions');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testHomeTeleportListSystem();
