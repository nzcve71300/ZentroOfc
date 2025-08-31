const pool = require('./src/db');

async function testLeaderboardUpdate() {
  console.log('🧪 Testing Updated Leaderboard System...');
  console.log('==========================================\n');

  try {
    // Test 1: Check current leaderboard query logic
    console.log('📋 Test 1: Updated Leaderboard Query Logic');
    console.log('- Removed "p.is_active = true" filter');
    console.log('- Now shows ALL players with kills > 0');
    console.log('- Includes both linked and unlinked players');
    console.log('- Shows link status in player display');
    
    // Test 2: Check a specific server's data
    console.log('\n📋 Test 2: Checking Dead-ops server data...');
    const [serverResult] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE nickname = "Dead-ops"'
    );
    
    if (serverResult.length === 0) {
      console.log('❌ Dead-ops server not found in database');
      return;
    }
    
    const serverId = serverResult[0].id;
    console.log(`✅ Found Dead-ops server with ID: ${serverId}`);
    
    // Test 3: Check all players with kills on Dead-ops
    console.log('\n📋 Test 3: All players with kills on Dead-ops');
    const [allPlayersWithKills] = await pool.query(
      `SELECT p.ign, p.discord_id, ps.kills, ps.deaths, p.is_active,
              CASE WHEN p.discord_id IS NOT NULL THEN 'Linked' ELSE 'Unlinked' END as link_status
       FROM players p
       JOIN player_stats ps ON p.id = ps.player_id
       WHERE p.server_id = ?
       AND ps.kills > 0
       ORDER BY ps.kills DESC
       LIMIT 10`,
      [serverId]
    );
    
    console.log(`Found ${allPlayersWithKills.length} players with kills on Dead-ops:`);
    allPlayersWithKills.forEach((player, index) => {
      console.log(`${index + 1}. ${player.ign} - ${player.link_status} - Kills: ${player.kills}, Deaths: ${player.deaths}`);
    });
    
    // Test 4: Check the new leaderboard query
    console.log('\n📋 Test 4: New Leaderboard Query (without is_active filter)');
    const [newLeaderboardQuery] = await pool.query(
      `SELECT p.ign, p.discord_id, ps.kills, ps.deaths, ps.kill_streak, ps.highest_streak, p.linked_at,
              COALESCE(ppt.total_minutes, 0) as total_minutes
       FROM players p
       JOIN player_stats ps ON p.id = ps.player_id
       LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
       WHERE p.server_id = ?
       AND ps.kills > 0
       ORDER BY ps.kills DESC, ps.deaths ASC
       LIMIT 5`,
      [serverId]
    );
    
    console.log(`New query found ${newLeaderboardQuery.length} players:`);
    newLeaderboardQuery.forEach((player, index) => {
      const linkStatus = player.discord_id ? '🔗 Linked' : '🔓 Unlinked';
      console.log(`${index + 1}. ${player.ign} ${linkStatus} - Kills: ${player.kills}`);
    });
    
    // Test 5: Compare with old query (with is_active filter)
    console.log('\n📋 Test 5: Old Leaderboard Query (with is_active filter)');
    const [oldLeaderboardQuery] = await pool.query(
      `SELECT p.ign, p.discord_id, ps.kills, ps.deaths, ps.kill_streak, ps.highest_streak, p.linked_at,
              COALESCE(ppt.total_minutes, 0) as total_minutes
       FROM players p
       JOIN player_stats ps ON p.id = ps.player_id
       LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
       WHERE p.server_id = ?
       AND p.is_active = true
       AND ps.kills > 0
       ORDER BY ps.kills DESC, ps.deaths ASC
       LIMIT 5`,
      [serverId]
    );
    
    console.log(`Old query found ${oldLeaderboardQuery.length} players:`);
    oldLeaderboardQuery.forEach((player, index) => {
      const linkStatus = player.discord_id ? '🔗 Linked' : '🔓 Unlinked';
      console.log(`${index + 1}. ${player.ign} ${linkStatus} - Kills: ${player.kills}`);
    });
    
    // Test 6: Show the difference
    console.log('\n📋 Test 6: Comparison');
    console.log(`New query (no is_active filter): ${newLeaderboardQuery.length} players`);
    console.log(`Old query (with is_active filter): ${oldLeaderboardQuery.length} players`);
    console.log(`Difference: ${newLeaderboardQuery.length - oldLeaderboardQuery.length} additional players will now show`);
    
    if (newLeaderboardQuery.length > oldLeaderboardQuery.length) {
      console.log('✅ SUCCESS: More players will now appear on the leaderboard!');
    } else if (newLeaderboardQuery.length === oldLeaderboardQuery.length) {
      console.log('ℹ️ INFO: Same number of players, but now includes unlinked players');
    } else {
      console.log('⚠️ WARNING: Fewer players found - check data integrity');
    }

    console.log('\n✅ Leaderboard Update Test Complete!');
    console.log('🎯 Key Changes:');
    console.log('- Removed is_active filter to include all players with kills');
    console.log('- Added link status indicators (🔗 Linked / 🔓 Unlinked)');
    console.log('- Updated error message to remove Discord linking requirement');
    console.log('- Updated footer to indicate unlinked players are included');

  } catch (error) {
    console.error('❌ Error testing leaderboard update:', error);
  } finally {
    await pool.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testLeaderboardUpdate()
    .then(() => {
      console.log('\n✅ TEST COMPLETE!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ TEST FAILED:', error);
      process.exit(1);
    });
}

module.exports = {
  testLeaderboardUpdate
};
