const pool = require('./src/db');

async function debugKitAuth() {
  try {
    console.log('🔍 SSH: Debugging Kit Authorization Issue...');
    
    const testPlayer = 'nzcve7130';
    const testKit = 'ELITEkit1';
    const serverId = '1754690822459_bxb3nuglj';
    const serverName = 'Snowy Billiards 2x';

    // 1. Check kit_auth table structure
    console.log('\n📋 kit_auth table structure:');
    const [columns] = await pool.query('DESCRIBE kit_auth');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // 2. Check all records in kit_auth table
    console.log('\n📊 All kit_auth records:');
    const [allRecords] = await pool.query('SELECT * FROM kit_auth');
    if (allRecords.length === 0) {
      console.log('   ❌ No records found in kit_auth table!');
    } else {
      allRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Server: ${record.server_id}, Kit: ${record.kit_name || 'N/A'}, Player: ${record.player_name || 'N/A'}, Discord: ${record.discord_id || 'N/A'}, Kitlist: ${record.kitlist || 'N/A'}`);
      });
    }

    // 3. Check for our specific player and kit
    console.log(`\n🔍 Looking for player "${testPlayer}" with kit "${testKit}":');
    const [specificRecords] = await pool.query(
      'SELECT * FROM kit_auth WHERE server_id = ? AND (kit_name = ? OR kitlist LIKE ?) AND (LOWER(player_name) = LOWER(?) OR discord_id IN (SELECT discord_id FROM players WHERE LOWER(ign) = LOWER(?)))',
      [serverId, testKit, `%${testKit}%`, testPlayer, testPlayer]
    );
    
    if (specificRecords.length === 0) {
      console.log('   ❌ No matching records found!');
      
      // Check if player exists in players table
      console.log(`\n👤 Checking if player "${testPlayer}" exists in players table:`);
      const [playerRecords] = await pool.query(
        'SELECT id, discord_id, ign, server_id FROM players WHERE LOWER(ign) = LOWER(?) AND server_id = ?',
        [testPlayer, serverId]
      );
      
      if (playerRecords.length === 0) {
        console.log('   ❌ Player not found in players table!');
      } else {
        playerRecords.forEach((player, index) => {
          console.log(`   ${index + 1}. Player ID: ${player.id}, Discord: ${player.discord_id}, IGN: ${player.ign}`);
        });
      }
    } else {
      console.log('   ✅ Found matching records:');
      specificRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Kit: ${record.kit_name || record.kitlist}, Player: ${record.player_name}, Discord: ${record.discord_id}`);
      });
    }

    // 4. Check autokit config
    console.log('\n⚙️ Checking autokit configuration:');
    const [autokitRecords] = await pool.query(
      'SELECT * FROM autokit WHERE server_id = ? AND game_name = ?',
      [serverId, testKit]
    );
    
    if (autokitRecords.length === 0) {
      console.log('   ❌ No autokit config found for this kit!');
    } else {
      autokitRecords.forEach((config, index) => {
        console.log(`   ${index + 1}. ID: ${config.id}, Enabled: ${config.enabled}, Cooldown: ${config.cooldown}, Kit: ${config.game_name}`);
      });
    }

    // 5. Show what the actual authorization query should be
    console.log('\n🔍 Testing authorization queries:');
    
    // Query 1: New schema (kit_name + player_name)
    console.log('\n   Query 1: New schema (kit_name + player_name)');
    const [newSchemaResults] = await pool.query(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kit_name = ? AND LOWER(player_name) = LOWER(?)',
      [serverId, testKit, testPlayer]
    );
    console.log(`   Results: ${newSchemaResults.length} records found`);
    
    // Query 2: Old schema (kitlist + discord_id)
    console.log('\n   Query 2: Old schema (kitlist + discord_id via players table)');
    const [oldSchemaResults] = await pool.query(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND ka.kitlist LIKE ? AND LOWER(p.ign) = LOWER(?)`,
      [serverId, `%${testKit}%`, testPlayer]
    );
    console.log(`   Results: ${oldSchemaResults.length} records found`);

    // Query 3: Mixed approach
    console.log('\n   Query 3: Mixed approach (both schemas)');
    const [mixedResults] = await pool.query(
      `SELECT * FROM kit_auth 
       WHERE server_id = ? AND (
         (kit_name = ? AND LOWER(player_name) = LOWER(?)) OR
         (kitlist LIKE ? AND discord_id IN (SELECT discord_id FROM players WHERE LOWER(ign) = LOWER(?) AND server_id = ?))
       )`,
      [serverId, testKit, testPlayer, `%${testKit}%`, testPlayer, serverId]
    );
    console.log(`   Results: ${mixedResults.length} records found`);
    mixedResults.forEach((record, index) => {
      console.log(`     ${index + 1}. Kit: ${record.kit_name || record.kitlist}, Player: ${record.player_name}, Discord: ${record.discord_id}`);
    });

    console.log('\n💡 Recommendations:');
    if (allRecords.length === 0) {
      console.log('   1. ❌ kit_auth table is empty - need to add records');
    }
    if (autokitRecords.length === 0) {
      console.log('   2. ❌ No autokit config - kit won\'t be processed');
    }
    if (specificRecords.length === 0) {
      console.log('   3. ❌ Player not authorized for this kit - need to run /add-to-kit-list');
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugKitAuth().catch(console.error);