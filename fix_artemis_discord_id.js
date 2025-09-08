const pool = require('./src/db');

/**
 * Fix Artemis2689 Discord ID mismatch
 */
async function fixArtemisDiscordId() {
  try {
    console.log('🔍 Fixing Artemis2689 Discord ID mismatch...\n');
    
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
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' OR p.ign LIKE '%artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    for (const record of currentRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Find the active records
    const activeRecords = currentRecords.filter(r => r.is_active);
    const inactiveRecords = currentRecords.filter(r => !r.is_active);
    
    console.log(`\n📊 Current Status:`);
    console.log(`  Active records: ${activeRecords.length}`);
    console.log(`  Inactive records: ${inactiveRecords.length}`);
    
    // Plan the fix
    console.log(`\n🔄 Fix Plan:`);
    console.log(`  1. Update active records to use correct Discord ID: ${correctDiscordId}`);
    console.log(`  2. Keep all balances intact`);
    console.log(`  3. Deactivate any remaining wrong records`);
    
    // Step 1: Update the active records to use the correct Discord ID
    console.log(`\n🔄 Step 1: Updating active records to correct Discord ID...`);
    
    for (const record of activeRecords) {
      console.log(`  Updating ID=${record.id} (${record.nickname}) from Discord=${record.discord_id} to Discord=${correctDiscordId}`);
      
      await pool.query(
        'UPDATE players SET discord_id = ?, linked_at = CURRENT_TIMESTAMP WHERE id = ?',
        [correctDiscordId, record.id]
      );
      
      console.log(`    ✅ Updated`);
    }
    
    // Step 2: Check if there are any records with the correct Discord ID that are inactive
    console.log(`\n🔍 Step 2: Checking for inactive records with correct Discord ID...`);
    
    const [correctDiscordRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' AND p.discord_id = ?
    `, [correctDiscordId]);
    
    console.log(`  Found ${correctDiscordRecords.length} records with correct Discord ID`);
    
    for (const record of correctDiscordRecords) {
      console.log(`    ID=${record.id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
      
      if (!record.is_active) {
        console.log(`    🔄 Reactivating record ID=${record.id}...`);
        await pool.query(
          'UPDATE players SET is_active = true, linked_at = CURRENT_TIMESTAMP, unlinked_at = NULL, unlink_reason = NULL WHERE id = ?',
          [record.id]
        );
        console.log(`    ✅ Reactivated`);
      }
    }
    
    // Step 3: Deactivate any remaining wrong records
    console.log(`\n🗑️ Step 3: Deactivating wrong records...`);
    
    const wrongRecords = currentRecords.filter(r => 
      r.discord_id !== correctDiscordId && r.discord_id !== null
    );
    
    for (const record of wrongRecords) {
      if (record.is_active) {
        console.log(`  Deactivating ID=${record.id} (Discord=${record.discord_id})...`);
        await pool.query(
          'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Corrected Discord ID mismatch" WHERE id = ?',
          [record.id]
        );
        console.log(`    ✅ Deactivated`);
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
    console.log(`\n✅ Active records (should all have correct Discord ID):`);
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
fixArtemisDiscordId();
