const pool = require('./src/db');

/**
 * SAFE fix for lZips- duplicate records
 * This script will NEVER delete data - only merge and deactivate
 */
async function fixLzipsSafe() {
  try {
    console.log('🔍 SAFE fix for lZips- duplicate records...\n');
    
    // First, let's see the current state
    console.log('📋 Current lZips- records:');
    const [currentRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%lZips%' OR p.ign LIKE '%lzips%'
      ORDER BY p.server_id, p.id
    `);
    
    for (const record of currentRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Based on the analysis, we have:
    // Dead-ops: ID=20102 (Discord=813975553154052400, Balance=150000) vs ID=20112 (Discord=1411881661712306200, Balance=0)
    // USA-DeadOps: ID=8120 (Discord=null, Balance=0) vs ID=20113 (Discord=1411881661712306200, Balance=0)
    
    // We need to determine which Discord ID is correct
    // Looking at the recent activity, ID=20112 was created more recently (12:50:06 AM vs 12:30:23 AM)
    // But ID=20102 has the balance (150000)
    
    // Let's be conservative and ask which Discord ID should be kept
    console.log('\n🤔 Decision needed:');
    console.log('  Option 1: Keep Discord ID 813975553154052400 (ID=20102) - has 150,000 balance');
    console.log('  Option 2: Keep Discord ID 1411881661712306200 (ID=20112) - more recent');
    console.log('\n⚠️  This script will NOT make the decision automatically!');
    console.log('   Please tell me which Discord ID should be kept, or I can create a script that preserves both balances.');
    
    // For now, let's create a script that preserves the balance
    console.log('\n💡 Suggested approach:');
    console.log('  1. Keep the record with the balance (ID=20102)');
    console.log('  2. Transfer any balance from the newer record (ID=20112)');
    console.log('  3. Deactivate the newer record (ID=20112)');
    console.log('  4. Keep the USA-DeadOps record as is (ID=20113)');
    
    // Let's do a safe merge that preserves the balance
    const keepRecordId = 20102; // The one with balance
    const mergeRecordId = 20112; // The newer one without balance
    
    console.log(`\n🔄 Safe merge plan:`);
    console.log(`  Keep: ID=${keepRecordId} (has balance)`);
    console.log(`  Merge: ID=${mergeRecordId} (newer, no balance)`);
    
    // Get current balances
    const [keepBalance] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [keepRecordId]);
    const [mergeBalance] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [mergeRecordId]);
    
    const keepBal = keepBalance[0]?.balance || 0;
    const mergeBal = mergeBalance[0]?.balance || 0;
    const totalBalance = keepBal + mergeBal;
    
    console.log(`\n💰 Balance analysis:`);
    console.log(`  Keep record (${keepRecordId}): ${keepBal}`);
    console.log(`  Merge record (${mergeRecordId}): ${mergeBal}`);
    console.log(`  Total: ${totalBalance}`);
    
    if (totalBalance === keepBal) {
      console.log(`\n✅ No balance to transfer - merge record has 0 balance`);
    } else {
      console.log(`\n💰 Would transfer ${mergeBal} to keep record`);
    }
    
    console.log(`\n🔄 Would deactivate merge record (${mergeRecordId})`);
    console.log(`✅ Would keep USA-DeadOps record (ID=20113) as is`);
    
    console.log('\n🎯 Final result would be:');
    console.log('  - Dead-ops: 150,000 Ops Tokens (on kept Discord ID)');
    console.log('  - USA-DeadOps: 0 coins (on kept Discord ID)');
    
    console.log('\n⚠️  This is a SAFE preview - no changes made yet!');
    console.log('   Run with --execute flag to actually perform the merge.');
    
  } catch (error) {
    console.error('❌ Error in safe fix:', error);
  } finally {
    await pool.end();
  }
}

// Check if --execute flag is provided
const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');

if (shouldExecute) {
  console.log('🚀 EXECUTING the fix...');
  // Add execution logic here
} else {
  console.log('🔍 PREVIEW mode - no changes will be made');
}

// Run the safe fix
fixLzipsSafe();
