const pool = require('./src/db');

/**
 * SAFE fix for Artemis2689 Discord ID mismatch - handles database constraints
 */
async function fixArtemisDiscordIdSafe() {
  try {
    console.log('🔍 SAFE fix for Artemis2689 Discord ID mismatch...\n');
    
    const correctDiscordId = '680226741960441889'; // The correct Discord ID
    const wrongDiscordId = '680226741960441900';   // What we have in database
    const currentDiscordId = '651542249139179900'; // The one we kept (wrong)
    
    console.log('📋 Discord ID Analysis:');
    console.log(`  Correct Discord ID: ${correctDiscordId}`);
    console.log(`  Wrong Discord ID in DB: ${wrongDiscordId}`);
    console.log(`  Current active Discord ID: ${currentDiscordId}`);
    
    // Check current state
    console.log('\n📋 Current Artemis records:');
    const [currentRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' OR p.ign LIKE '%artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    for (const record of currentRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Find the active records
    const activeRecords = currentRecords.filter(r => r.is_active);
    
    console.log(`\n📊 Current Status:`);
    console.log(`  Active records: ${activeRecords.length}`);
    
    // Plan the fix - we need to be careful about the database constraint
    console.log(`\n🔄 SAFE Fix Plan:`);
    console.log(`  1. First, deactivate ALL current active records`);
    console.log(`  2. Then, reactivate the records with the correct Discord ID`);
    console.log(`  3. If no records exist with correct Discord ID, create new ones`);
    
    // Step 1: Deactivate all current active records
    console.log(`\n🗑️ Step 1: Deactivating all current active records...`);
    
    for (const record of activeRecords) {
      console.log(`  Deactivating ID=${record.id} (${record.nickname}, Discord=${record.discord_id})...`);
      await pool.query(
        'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Preparing for Discord ID correction" WHERE id = ?',
        [record.id]
      );
      console.log(`    ✅ Deactivated`);
    }
    
    // Step 2: Check if records with correct Discord ID exist
    console.log(`\n🔍 Step 2: Checking for records with correct Discord ID...`);
    
    const [correctDiscordRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' AND p.discord_id = ?
    `, [correctDiscordId]);
    
    console.log(`  Found ${correctDiscordRecords.length} records with correct Discord ID`);
    
    // Step 3: Reactivate or create records with correct Discord ID
    console.log(`\n🔄 Step 3: Setting up records with correct Discord ID...`);
    
    // Group by server
    const serverGroups = {};
    for (const record of correctDiscordRecords) {
      const serverId = record.server_id;
      if (!serverGroups[serverId]) {
        serverGroups[serverId] = [];
      }
      serverGroups[serverId].push(record);
    }
    
    // Also check what servers we need to cover
    const neededServers = [...new Set(currentRecords.map(r => r.server_id))];
    
    for (const serverId of neededServers) {
      const serverName = currentRecords.find(r => r.server_id === serverId)?.nickname || 'Unknown';
      const serverRecords = serverGroups[serverId] || [];
      
      console.log(`\n  📍 Server: ${serverName} (ID: ${serverId})`);
      
      if (serverRecords.length > 0) {
        // Use the record with the highest balance
        const bestRecord = serverRecords.reduce((best, current) => 
          (current.balance || 0) > (best.balance || 0) ? current : best
        );
        
        console.log(`    🔄 Reactivating ID=${bestRecord.id} (Balance: ${bestRecord.balance || 0})...`);
        await pool.query(
          'UPDATE players SET is_active = true, linked_at = CURRENT_TIMESTAMP, unlinked_at = NULL, unlink_reason = NULL WHERE id = ?',
          [bestRecord.id]
        );
        console.log(`    ✅ Reactivated`);
        
        // Deactivate other records on this server
        for (const record of serverRecords) {
          if (record.id !== bestRecord.id) {
            console.log(`    🗑️ Deactivating duplicate ID=${record.id}...`);
            await pool.query(
              'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Duplicate - kept record with higher balance" WHERE id = ?',
              [record.id]
            );
            console.log(`    ✅ Deactivated`);
          }
        }
      } else {
        // No record with correct Discord ID exists for this server
        console.log(`    ⚠️ No record with correct Discord ID found for ${serverName}`);
        console.log(`    💡 Need to create new record or update existing one`);
        
        // Find the best existing record for this server (with balance)
        const existingRecords = currentRecords.filter(r => r.server_id === serverId);
        const recordWithBalance = existingRecords.find(r => (r.balance || 0) > 0);
        
        if (recordWithBalance) {
          console.log(`    🔄 Updating ID=${recordWithBalance.id} to use correct Discord ID...`);
          await pool.query(
            'UPDATE players SET discord_id = ?, is_active = true, linked_at = CURRENT_TIMESTAMP, unlinked_at = NULL, unlink_reason = NULL WHERE id = ?',
            [correctDiscordId, recordWithBalance.id]
          );
          console.log(`    ✅ Updated`);
        } else {
          console.log(`    ⚠️ No record with balance found for ${serverName} - skipping`);
        }
      }
    }
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const [finalRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' OR p.ign LIKE '%artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    console.log('📋 Final state:');
    for (const record of finalRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Show active records
    const finalActiveRecords = finalRecords.filter(r => r.is_active);
    console.log(`\n✅ Active records:`);
    for (const record of finalActiveRecords) {
      console.log(`  - ${record.nickname}: ${record.balance || 0} (Discord: ${record.discord_id})`);
    }
    
    console.log('\n🎉 Artemis2689 Discord ID fix completed!');
    console.log(`The user should now be able to use Discord ID: ${correctDiscordId}`);
    
  } catch (error) {
    console.error('❌ Error fixing Artemis Discord ID:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixArtemisDiscordIdSafe();
