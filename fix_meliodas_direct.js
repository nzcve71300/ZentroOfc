const pool = require('./src/db');

/**
 * Direct fix for Meliodas - using the exact record IDs we know exist
 */
async function fixMeliodasDirect() {
  try {
    console.log('🔍 Direct fix for Meliodas balance issue...\n');
    
    // We know these exact IDs from the debug output:
    // ID=20031: Wrong Discord ID (22115433549209050), Active=1, Balance=253250, Dead-ops
    // ID=20060: Correct Discord ID (1170856076569223200), Active=0, Balance=0, Dead-ops
    // ID=20061: Correct Discord ID (1170856076569223200), Active=1, Balance=1000, USA-DeadOps
    
    const wrongRecordId = 20031;  // Dead-ops, wrong Discord ID, has the balance
    const correctRecordId = 20060; // Dead-ops, correct Discord ID, inactive
    const correctRecordId2 = 20061; // USA-DeadOps, correct Discord ID, already correct
    
    console.log('📋 Plan:');
    console.log(`  1. Reactivate record ${correctRecordId} (Dead-ops, correct Discord ID)`);
    console.log(`  2. Transfer balance from ${wrongRecordId} to ${correctRecordId}`);
    console.log(`  3. Deactivate record ${wrongRecordId} (wrong Discord ID)`);
    console.log(`  4. Keep record ${correctRecordId2} as is (USA-DeadOps, already correct)`);
    
    // Step 1: Get current balances
    const [wrongBalance] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [wrongRecordId]);
    const [correctBalance] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [correctRecordId]);
    
    const wrongBal = wrongBalance[0]?.balance || 0;
    const correctBal = correctBalance[0]?.balance || 0;
    const totalBalance = wrongBal + correctBal;
    
    console.log(`\n💰 Current balances:`);
    console.log(`  Wrong record (${wrongRecordId}): ${wrongBal}`);
    console.log(`  Correct record (${correctRecordId}): ${correctBal}`);
    console.log(`  Total to transfer: ${totalBalance}`);
    
    // Step 2: Reactivate the correct record
    console.log(`\n🔄 Step 1: Reactivating correct record (${correctRecordId})...`);
    await pool.query(
      'UPDATE players SET is_active = true, linked_at = CURRENT_TIMESTAMP, unlinked_at = NULL, unlink_reason = NULL WHERE id = ?',
      [correctRecordId]
    );
    console.log('  ✅ Reactivated');
    
    // Step 3: Transfer balance
    console.log(`\n💰 Step 2: Transferring balance...`);
    await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalBalance, correctRecordId]);
    console.log(`  ✅ Transferred ${totalBalance} to correct record`);
    
    // Step 4: Deactivate wrong record
    console.log(`\n🗑️ Step 3: Deactivating wrong record (${wrongRecordId})...`);
    await pool.query(
      'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Corrected duplicate merge - wrong Discord ID" WHERE id = ?',
      [wrongRecordId]
    );
    console.log('  ✅ Deactivated');
    
    // Step 5: Delete wrong economy record
    console.log(`\n🗑️ Step 4: Deleting wrong economy record...`);
    await pool.query('DELETE FROM economy WHERE player_id = ?', [wrongRecordId]);
    console.log('  ✅ Deleted');
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const [finalRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Meliodas%'
      ORDER BY p.server_id, p.id
    `);
    
    console.log('📋 Final state:');
    for (const record of finalRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    console.log('\n🎉 Meliodas balance fix completed!');
    console.log('The user should now see:');
    console.log('  - Dead-ops: 253250 Ops Tokens (on correct Discord ID)');
    console.log('  - USA-DeadOps: 1000 coins (on correct Discord ID)');
    
  } catch (error) {
    console.error('❌ Error fixing Meliodas balance:', error);
  } finally {
    await pool.end();
  }
}

// Run the direct fix
fixMeliodasDirect();
