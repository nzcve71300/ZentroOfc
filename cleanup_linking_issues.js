const pool = require('./src/db');

async function cleanupLinkingIssues() {
  console.log('🧹 Cleaning up linking issues...');
  
  try {
    // 1. Remove duplicate active records for the same IGN on the same server
    console.log('\n📋 Step 1: Removing duplicate active records...');
    const [duplicateResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.ign = p2.ign 
      AND p1.is_active = true 
      AND p2.is_active = true
    `);
    console.log(`Removed ${duplicateResult.affectedRows} duplicate active records`);
    
    // 2. Remove duplicate active records for the same Discord ID on the same server
    const [duplicateDiscordResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.discord_id = p2.discord_id 
      AND p1.discord_id IS NOT NULL
      AND p2.discord_id IS NOT NULL
      AND p1.is_active = true 
      AND p2.is_active = true
    `);
    console.log(`Removed ${duplicateDiscordResult.affectedRows} duplicate Discord ID records`);
    
    // 3. Remove orphaned inactive records (no Discord ID, no linked_at)
    console.log('\n📋 Step 2: Removing orphaned inactive records...');
    const [orphanedResult] = await pool.query(`
      DELETE FROM players 
      WHERE is_active = false 
      AND discord_id IS NULL
      AND linked_at IS NULL
    `);
    console.log(`Removed ${orphanedResult.affectedRows} orphaned inactive records`);
    
    // 4. Remove duplicate kit_auth entries
    console.log('\n📋 Step 3: Removing duplicate kit_auth entries...');
    const [duplicateKitAuth] = await pool.query(`
      DELETE ka1 FROM kit_auth ka1
      INNER JOIN kit_auth ka2 
      WHERE ka1.id > ka2.id 
      AND ka1.server_id = ka2.server_id 
      AND ka1.player_name = ka2.player_name 
      AND ka1.kitlist = ka2.kitlist
    `);
    console.log(`Removed ${duplicateKitAuth.affectedRows} duplicate kit_auth entries`);
    
    // 5. Remove orphaned kit_auth entries (no corresponding player)
    console.log('\n📋 Step 4: Removing orphaned kit_auth entries...');
    const [orphanedKitAuth] = await pool.query(`
      DELETE ka FROM kit_auth ka
      LEFT JOIN players p ON ka.discord_id = p.discord_id AND ka.server_id = p.server_id
      WHERE p.id IS NULL
      AND ka.discord_id IS NOT NULL
    `);
    console.log(`Removed ${orphanedKitAuth.affectedRows} orphaned kit_auth entries`);
    
    // 6. Clean up any remaining inactive records that might cause conflicts
    console.log('\n📋 Step 5: Cleaning up remaining inactive records...');
    const [inactiveCleanup] = await pool.query(`
      DELETE FROM players 
      WHERE is_active = false 
      AND discord_id IS NOT NULL
      AND unlinked_at IS NOT NULL
      AND DATEDIFF(NOW(), unlinked_at) > 30
    `);
    console.log(`Removed ${inactiveCleanup.affectedRows} old inactive records (unlinked > 30 days ago)`);
    
    // 7. Reset any conflicting active records
    console.log('\n📋 Step 6: Resolving remaining conflicts...');
    
    // Find and deactivate conflicting records (same IGN, different Discord IDs)
    const [conflictReset] = await pool.query(`
      UPDATE players p1
      JOIN players p2 ON p1.ign = p2.ign AND p1.server_id = p2.server_id AND p1.id != p2.id
      SET p1.is_active = false, p1.unlinked_at = CURRENT_TIMESTAMP
      WHERE p1.is_active = true 
      AND p2.is_active = true
      AND p1.discord_id != p2.discord_id
      AND p1.discord_id IS NOT NULL
      AND p2.discord_id IS NOT NULL
      AND p1.id > p2.id
    `);
    console.log(`Deactivated ${conflictReset.affectedRows} conflicting records`);
    
    console.log('\n✅ Cleanup completed!');
    console.log('\n📋 Summary of cleanup:');
    console.log(`- Removed ${duplicateResult.affectedRows} duplicate active records`);
    console.log(`- Removed ${duplicateDiscordResult.affectedRows} duplicate Discord ID records`);
    console.log(`- Removed ${orphanedResult.affectedRows} orphaned inactive records`);
    console.log(`- Removed ${duplicateKitAuth.affectedRows} duplicate kit_auth entries`);
    console.log(`- Removed ${orphanedKitAuth.affectedRows} orphaned kit_auth entries`);
    console.log(`- Removed ${inactiveCleanup.affectedRows} old inactive records`);
    console.log(`- Deactivated ${conflictReset.affectedRows} conflicting records`);
    
    console.log('\n🔧 Next steps:');
    console.log('1. Run: node diagnose_linking_issues.js (to verify cleanup)');
    console.log('2. Test /link and /unlink commands');
    console.log('3. Test VIP kit claims');
    
  } catch (error) {
    console.error('❌ Error in cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupLinkingIssues(); 