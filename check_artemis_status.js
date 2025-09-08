const pool = require('./src/db');

/**
 * Check the current status of Artemis2689 records
 */
async function checkArtemisStatus() {
  try {
    console.log('🔍 Checking Artemis2689 current status...\n');
    
    // Check all Artemis records
    const [artemisRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, p.linked_at, p.unlinked_at, p.unlink_reason, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' OR p.ign LIKE '%artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    if (artemisRecords.length === 0) {
      console.log('❌ No Artemis records found!');
      return;
    }
    
    console.log('📋 Current Artemis records:');
    for (const record of artemisRecords) {
      const activeStatus = record.is_active ? 'ACTIVE' : 'INACTIVE';
      const linkedInfo = record.linked_at ? new Date(record.linked_at).toLocaleString() : 'Unknown';
      const unlinkedInfo = record.unlinked_at ? new Date(record.unlinked_at).toLocaleString() : 'N/A';
      const reasonInfo = record.unlink_reason || 'N/A';
      
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}`);
      console.log(`    Status: ${activeStatus}, Balance: ${record.balance || 0}`);
      console.log(`    Linked: ${linkedInfo}, Unlinked: ${unlinkedInfo}`);
      console.log(`    Reason: ${reasonInfo}`);
      console.log('');
    }
    
    // Check which Discord IDs are active
    const activeRecords = artemisRecords.filter(r => r.is_active);
    const inactiveRecords = artemisRecords.filter(r => !r.is_active);
    
    console.log(`📊 Summary:`);
    console.log(`  Total records: ${artemisRecords.length}`);
    console.log(`  Active records: ${activeRecords.length}`);
    console.log(`  Inactive records: ${inactiveRecords.length}`);
    
    if (activeRecords.length === 0) {
      console.log('\n🚨 PROBLEM: No active Artemis records found!');
      console.log('   This means Artemis2689 appears as "not linked"');
      
      // Find the record with the highest balance to reactivate
      const recordWithBalance = artemisRecords.find(r => (r.balance || 0) > 0);
      if (recordWithBalance) {
        console.log(`\n💡 Solution: Reactivate record ID=${recordWithBalance.id} (has balance: ${recordWithBalance.balance})`);
      }
    } else {
      console.log('\n✅ Active records found:');
      for (const record of activeRecords) {
        console.log(`  - ${record.nickname}: ${record.balance || 0} (Discord: ${record.discord_id})`);
      }
    }
    
    // Check recent activity
    console.log('\n🔍 Recent activity:');
    const [recentActivity] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, p.linked_at, p.unlinked_at, p.unlink_reason, rs.nickname
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' OR p.ign LIKE '%artemis%'
      ORDER BY COALESCE(p.unlinked_at, p.linked_at) DESC
      LIMIT 10
    `);
    
    for (const activity of recentActivity) {
      const activeStatus = activity.is_active ? 'ACTIVE' : 'INACTIVE';
      const dateInfo = activity.unlinked_at ? 
        `Unlinked: ${new Date(activity.unlinked_at).toLocaleString()}` : 
        `Linked: ${new Date(activity.linked_at).toLocaleString()}`;
      const reasonInfo = activity.unlink_reason || 'N/A';
      
      console.log(`  ID=${activity.id}, ${activeStatus}, ${dateInfo}, Reason: ${reasonInfo}, Server: ${activity.nickname}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking Artemis status:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkArtemisStatus();
