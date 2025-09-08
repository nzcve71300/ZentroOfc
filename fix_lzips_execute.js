const pool = require('./src/db');

/**
 * EXECUTE the lZips- fix - keeps the record with balance
 */
async function fixLzipsExecute() {
  try {
    console.log('🚀 EXECUTING lZips- fix...\n');
    
    // Keep the record with balance (ID=20102)
    const keepRecordId = 20102; // Discord=813975553154052400, Balance=150000
    const mergeRecordId = 20112; // Discord=1411881661712306200, Balance=0
    const usaRecordId = 20113; // USA-DeadOps, Discord=1411881661712306200, Balance=0
    
    console.log('📋 Plan:');
    console.log(`  ✅ Keep: ID=${keepRecordId} (Discord=813975553154052400, Balance=150000)`);
    console.log(`  🗑️ Deactivate: ID=${mergeRecordId} (Discord=1411881661712306200, Balance=0)`);
    console.log(`  🔄 Update: ID=${usaRecordId} (USA-DeadOps) to use correct Discord ID`);
    
    // Step 1: Update USA-DeadOps record to use the correct Discord ID
    console.log(`\n🔄 Step 1: Updating USA-DeadOps record to use correct Discord ID...`);
    await pool.query(
      'UPDATE players SET discord_id = ?, linked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [813975553154052400, usaRecordId] // Use the Discord ID from the record with balance
    );
    console.log(`  ✅ Updated USA-DeadOps record (ID=${usaRecordId}) to use correct Discord ID`);
    
    // Step 2: Deactivate the duplicate Dead-ops record
    console.log(`\n🗑️ Step 2: Deactivating duplicate Dead-ops record...`);
    await pool.query(
      'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Merged duplicate - kept record with balance" WHERE id = ?',
      [mergeRecordId]
    );
    console.log(`  ✅ Deactivated duplicate record (ID=${mergeRecordId})`);
    
    // Step 3: Delete the duplicate economy record (it has 0 balance anyway)
    console.log(`\n🗑️ Step 3: Deleting duplicate economy record...`);
    await pool.query('DELETE FROM economy WHERE player_id = ?', [mergeRecordId]);
    console.log(`  ✅ Deleted duplicate economy record`);
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const [finalRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%lZips%' OR p.ign LIKE '%lzips%'
      ORDER BY p.server_id, p.id
    `);
    
    console.log('📋 Final state:');
    for (const record of finalRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    console.log('\n🎉 lZips- fix completed!');
    console.log('The user should now see:');
    console.log('  - Dead-ops: 150,000 Ops Tokens (on correct Discord ID)');
    console.log('  - USA-DeadOps: 0 coins (on correct Discord ID)');
    console.log('  - Both servers linked to Discord ID: 813975553154052400');
    
  } catch (error) {
    console.error('❌ Error fixing lZips-:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixLzipsExecute();
