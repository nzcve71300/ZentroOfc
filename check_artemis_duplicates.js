const pool = require('./src/db');

/**
 * Check for duplicate player records for Artemis2689
 */
async function checkArtemisDuplicates() {
  try {
    console.log('🔍 Checking for Artemis2689 duplicate records...\n');
    
    // Find all Artemis2689 records
    const [records] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    if (records.length === 0) {
      console.log('❌ No Artemis records found');
      return;
    }
    
    console.log('📋 All Artemis records:');
    for (const record of records) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Group by server to find duplicates
    const serverGroups = {};
    for (const record of records) {
      const serverId = record.server_id;
      if (!serverGroups[serverId]) {
        serverGroups[serverId] = [];
      }
      serverGroups[serverId].push(record);
    }
    
    console.log('\n🔍 Analyzing duplicates by server:');
    let hasDuplicates = false;
    
    for (const [serverId, serverRecords] of Object.entries(serverGroups)) {
      if (serverRecords.length > 1) {
        hasDuplicates = true;
        console.log(`\n📋 Server: ${serverRecords[0].nickname} (${serverRecords.length} records)`);
        
        for (const record of serverRecords) {
          console.log(`  ID=${record.id}, Discord=${record.discord_id}, Active=${record.is_active}, Balance=${record.balance || 0}`);
        }
        
        // Find the correct record (one with Discord ID)
        const withDiscord = serverRecords.filter(r => r.discord_id);
        const withoutDiscord = serverRecords.filter(r => !r.discord_id);
        
        if (withDiscord.length > 0) {
          console.log(`  ✅ Correct record: ID=${withDiscord[0].id} (has Discord ID)`);
          if (withoutDiscord.length > 0) {
            console.log(`  ❌ Duplicate record: ID=${withoutDiscord[0].id} (no Discord ID)`);
          }
        } else {
          console.log(`  ⚠️ No Discord ID found - need manual review`);
        }
      }
    }
    
    if (!hasDuplicates) {
      console.log('\n✅ No duplicates found for Artemis2689');
    } else {
      console.log('\n🔧 Duplicates found - fix needed');
    }
    
  } catch (error) {
    console.error('❌ Error checking Artemis duplicates:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkArtemisDuplicates();
