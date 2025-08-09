const pool = require('./src/db');

async function debugKitClaims() {
  try {
    console.log('🔍 SSH: Debugging Elite Kit Claims...');

    // Test data from the logs
    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const testServerName = 'Snowy Billiards 2x';
    const testPlayer = 'nzcve7130';
    const testKitKey = 'ELITEkit1';

    console.log(`\n🧪 Testing kit claim process:`);
    console.log(`   Guild ID: ${testGuildId}`);
    console.log(`   Server: ${testServerName}`);
    console.log(`   Player: ${testPlayer}`);
    console.log(`   Kit: ${testKitKey}`);

    // Step 1: Check if server exists
    console.log('\n📋 Step 1: Check server exists...');
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [testGuildId, testServerName]
    );

    if (serverResult.length === 0) {
      console.log('❌ ERROR: Server not found! This would cause kit claim to fail silently.');
      console.log('   The handleKitClaim function returns early when no server is found.');
      return;
    }

    const serverId = serverResult[0].id;
    console.log(`✅ Server found: ${serverId}`);

    // Step 2: Check autokits configuration
    console.log('\n📋 Step 2: Check autokits configuration...');
    const [autokitsResult] = await pool.query(
      'SELECT * FROM autokits WHERE server_id = ?',
      [serverId]
    );

    console.log(`Found ${autokitsResult.length} autokit configuration(s):`);
    if (autokitsResult.length === 0) {
      console.log('❌ WARNING: No autokits configuration found for this server');
      console.log('   This might cause issues with kit processing');
    } else {
      autokitsResult.forEach(config => {
        console.log(`   - Kit: ${config.kit_name}, Enabled: ${config.enabled}`);
      });
    }

    // Step 3: Check kit authorization (this is the most likely issue)
    console.log('\n📋 Step 3: Check kit authorization...');
    
    // Get the kit name mapping
    const kitNameMap = {
      'ELITEkit1': 'ELITEkit1',
      'ELITEkit2': 'ELITEkit2', 
      'ELITEkit3': 'ELITEkit3',
      'ELITEkit4': 'ELITEkit4',
      'ELITEkit5': 'ELITEkit5',
      'ELITEkit6': 'ELITEkit6',
      'ELITEkit7': 'ELITEkit7',
      'ELITEkit8': 'ELITEkit8',
      'ELITEkit9': 'ELITEkit9',
      'ELITEkit10': 'ELITEkit10',
      'ELITEkit11': 'ELITEkit11',
      'ELITEkit12': 'ELITEkit12',
      'ELITEkit13': 'ELITEkit13'
    };

    const kitName = kitNameMap[testKitKey] || testKitKey;
    console.log(`Kit name: ${kitName}`);

    // Check if player is in the kit authorization list
    const [authResult] = await pool.query(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kit_name = ? AND LOWER(player_name) = LOWER(?)',
      [serverId, kitName, testPlayer]
    );

    console.log(`Authorization check result: ${authResult.length} record(s)`);
    if (authResult.length === 0) {
      console.log('❌ FOUND THE ISSUE: Player is NOT authorized for this kit!');
      console.log(`   Player "${testPlayer}" is not in the kit_auth table for kit "${kitName}"`);
      console.log('   This is why the kit claim fails silently - the code returns early.');
      
      // Show what players ARE authorized for this kit
      const [allAuthResult] = await pool.query(
        'SELECT player_name FROM kit_auth WHERE server_id = ? AND kit_name = ?',
        [serverId, kitName]
      );
      
      console.log(`\n📋 Players authorized for ${kitName}:`);
      if (allAuthResult.length === 0) {
        console.log('   No players are authorized for this kit');
      } else {
        allAuthResult.forEach(auth => {
          console.log(`   - ${auth.player_name}`);
        });
      }
    } else {
      console.log('✅ Player is authorized for this kit');
    }

    // Step 4: Check all kit authorizations for this player
    console.log(`\n📋 Step 4: All kit authorizations for player "${testPlayer}":`);
    const [playerAuthResult] = await pool.query(
      'SELECT kit_name FROM kit_auth WHERE server_id = ? AND LOWER(player_name) = LOWER(?)',
      [serverId, testPlayer]
    );

    if (playerAuthResult.length === 0) {
      console.log('❌ Player has NO kit authorizations on this server');
    } else {
      console.log(`✅ Player is authorized for ${playerAuthResult.length} kit(s):`);
      playerAuthResult.forEach(auth => {
        console.log(`   - ${auth.kit_name}`);
      });
    }

    // Step 5: Show how to fix the issue
    console.log('\n🔧 How to fix the issue:');
    console.log('1. Use the Discord command to add the player to the kit list:');
    console.log(`   /add-to-kit-list player:${testPlayer} kit:${kitName}`);
    console.log('2. Or manually insert into database:');
    console.log(`   INSERT INTO kit_auth (server_id, kit_name, player_name) VALUES ('${serverId}', '${kitName}', '${testPlayer}');`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugKitClaims().catch(console.error);