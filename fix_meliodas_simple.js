const pool = require('./src/db');

/**
 * Simple fix for Meliodas - directly target the specific records we know exist
 */
async function fixMeliodasSimple() {
  try {
    console.log('🔍 Simple fix for Meliodas balance issue...\n');
    
    // Based on the output, we know these specific IDs:
    // ID=20031 (wrong Discord ID, active, 253250 balance) - Dead-ops
    // ID=20060 (correct Discord ID, inactive, 0 balance) - Dead-ops  
    // ID=20061 (correct Discord ID, active, 1000 balance) - USA-DeadOps
    
    const wrongRecordId = 20031; // Dead-ops, wrong Discord ID, has the balance
    const correctRecordId = 20060; // Dead-ops, correct Discord ID, inactive
    const correctRecordId2 = 20061; // USA-DeadOps, correct Discord ID, already correct
    
    console.log('📋 Current situation:');
    console.log(`  Wrong record (ID=${wrongRecordId}): Dead-ops, wrong Discord ID, has balance`);
    console.log(`  Correct record (ID=${correctRecordId}): Dead-ops, correct Discord ID, inactive`);
    console.log(`  Correct record (ID=${correctRecordId2}): USA-DeadOps, correct Discord ID, already correct`);
    
    // Get current balances
    const [wrongBalance] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [wrongRecordId]);
    const [correctBalance] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [correctRecordId]);
    
    const wrongBal = wrongBalance[0]?.balance || 0;
    const correctBal = correctBalance[0]?.balance || 0;
    const totalBalance = wrongBal + correctBal;
    
    console.log(`\n💰 Balance transfer:`);
    console.log(`  Wrong record balance: ${wrongBal}`);
    console.log(`  Correct record balance: ${correctBal}`);
    console.log(`  Total to transfer: ${totalBalance}`);
    
    // Step 1: Reactivate the correct record
    console.log(`\n🔄 Step 1: Reactivating correct record (ID=${correctRecordId})...`);
    await pool.query(
      'UPDATE players SET is_active = true, linked_at = CURRENT_TIMESTAMP, unlinked_at = NULL, unlink_reason = NULL WHERE id = ?',
      [correctRecordId]
    );
    console.log('  ✅ Reactivated');
    
    // Step 2: Transfer balance to correct record
    console.log(`\n💰 Step 2: Transferring balance...`);
    await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalBalance, correctRecordId]);
    console.log(`  ✅ Transferred ${totalBalance} to correct record`);
    
    // Step 3: Deactivate wrong record
    console.log(`\n🗑️ Step 3: Deactivating wrong record (ID=${wrongRecordId})...`);
    await pool.query(
      'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Corrected duplicate merge - wrong Discord ID" WHERE id = ?',
      [wrongRecordId]
    );
    console.log('  ✅ Deactivated');
    
    // Step 4: Delete wrong economy record
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

// Run the simple fix
fixMeliodasSimple();
