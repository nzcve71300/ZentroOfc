const pool = require('./src/db');

/**
 * Fix duplicate player records by merging them
 * This script will help resolve the Meliodas4994 vs MELIODAS4981 issue
 */
async function fixDuplicatePlayerRecords() {
  try {
    console.log('🔍 Searching for duplicate player records...');
    
    // Find all players with similar IGNs that might be duplicates
    const [duplicates] = await pool.query(`
      SELECT 
        p1.id as id1, p1.ign as ign1, p1.discord_id as discord_id1, p1.server_id as server_id1,
        p2.id as id2, p2.ign as ign2, p2.discord_id as discord_id2, p2.server_id as server_id2,
        rs.nickname as server_name
      FROM players p1
      JOIN players p2 ON p1.server_id = p2.server_id AND p1.guild_id = p2.guild_id
      JOIN rust_servers rs ON p1.server_id = rs.id
      WHERE p1.id < p2.id
      AND (
        (p1.discord_id IS NOT NULL AND p2.discord_id IS NOT NULL AND p1.discord_id = p2.discord_id)
        OR 
        (LOWER(p1.ign) LIKE LOWER(p2.ign) AND LOWER(p1.ign) LIKE '%meliodas%')
      )
      AND p1.is_active = true
      AND p2.is_active = true
    `);
    
    console.log(`Found ${duplicates.length} potential duplicate pairs:`);
    
    for (const dup of duplicates) {
      console.log(`\n📋 Duplicate pair found:`);
      console.log(`  Player 1: ID=${dup.id1}, IGN="${dup.ign1}", Discord=${dup.discord_id1}`);
      console.log(`  Player 2: ID=${dup.id2}, IGN="${dup.ign2}", Discord=${dup.discord_id2}`);
      console.log(`  Server: ${dup.server_name}`);
      
      // Get economy balances for both players
      const [balance1] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [dup.id1]);
      const [balance2] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [dup.id2]);
      
      const bal1 = balance1[0]?.balance || 0;
      const bal2 = balance2[0]?.balance || 0;
      
      console.log(`  Balance 1: ${bal1}`);
      console.log(`  Balance 2: ${bal2}`);
      
      // Determine which player to keep (prefer the one with Discord ID and higher balance)
      let keepId, mergeId, keepIgn, mergeIgn;
      
      if (dup.discord_id1 && !dup.discord_id2) {
        keepId = dup.id1;
        mergeId = dup.id2;
        keepIgn = dup.ign1;
        mergeIgn = dup.ign2;
      } else if (dup.discord_id2 && !dup.discord_id1) {
        keepId = dup.id2;
        mergeId = dup.id1;
        keepIgn = dup.ign2;
        mergeIgn = dup.ign1;
      } else if (bal1 >= bal2) {
        keepId = dup.id1;
        mergeId = dup.id2;
        keepIgn = dup.ign1;
        mergeIgn = dup.ign2;
      } else {
        keepId = dup.id2;
        mergeId = dup.id1;
        keepIgn = dup.ign2;
        mergeIgn = dup.ign1;
      }
      
      console.log(`  🎯 Keeping: ID=${keepId}, IGN="${keepIgn}"`);
      console.log(`  🗑️ Merging: ID=${mergeId}, IGN="${mergeIgn}"`);
      
      // Merge the balances
      const totalBalance = bal1 + bal2;
      await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalBalance, keepId]);
      
      // Deactivate the duplicate record
      await pool.query(
        'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Merged duplicate record" WHERE id = ?',
        [mergeId]
      );
      
      // Delete the duplicate economy record
      await pool.query('DELETE FROM economy WHERE player_id = ?', [mergeId]);
      
      console.log(`  ✅ Merged successfully! Total balance: ${totalBalance}`);
    }
    
    console.log('\n🎉 Duplicate player record cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error fixing duplicate player records:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixDuplicatePlayerRecords();
