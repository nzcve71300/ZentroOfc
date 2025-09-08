const pool = require('./src/db');

/**
 * Find all duplicate player records across all servers
 */
async function findAllDuplicates() {
  try {
    console.log('🔍 Finding all duplicate player records...\n');
    
    // Find all players with potential duplicates
    const [allPlayers] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      ORDER BY p.ign, p.server_id, p.id
    `);
    
    // Group by IGN to find duplicates
    const playerGroups = {};
    for (const player of allPlayers) {
      const key = player.ign.toLowerCase();
      if (!playerGroups[key]) {
        playerGroups[key] = [];
      }
      playerGroups[key].push(player);
    }
    
    console.log('📋 Duplicate Analysis:');
    let totalDuplicates = 0;
    let problematicPlayers = [];
    
    for (const [ign, players] of Object.entries(playerGroups)) {
      if (players.length > 1) {
        totalDuplicates++;
        
        // Group by server to see server-specific duplicates
        const serverGroups = {};
        for (const player of players) {
          const serverId = player.server_id;
          if (!serverGroups[serverId]) {
            serverGroups[serverId] = [];
          }
          serverGroups[serverId].push(player);
        }
        
        console.log(`\n🎯 Player: "${ign}" (${players.length} total records)`);
        
        let hasServerDuplicates = false;
        for (const [serverId, serverPlayers] of Object.entries(serverGroups)) {
          if (serverPlayers.length > 1) {
            hasServerDuplicates = true;
            const serverName = serverPlayers[0].nickname;
            console.log(`  📍 Server: ${serverName} (${serverPlayers.length} records)`);
            
            for (const player of serverPlayers) {
              const discordInfo = player.discord_id ? `Discord=${player.discord_id}` : 'Discord=null';
              const activeInfo = player.is_active ? 'ACTIVE' : 'INACTIVE';
              console.log(`    ID=${player.id}, ${discordInfo}, ${activeInfo}, Balance=${player.balance || 0}`);
            }
            
            // Check for problematic patterns
            const withDiscord = serverPlayers.filter(p => p.discord_id);
            const withoutDiscord = serverPlayers.filter(p => !p.discord_id);
            const activeWithDiscord = withDiscord.filter(p => p.is_active);
            const activeWithoutDiscord = withoutDiscord.filter(p => p.is_active);
            
            if (withDiscord.length > 1) {
              console.log(`    ⚠️ PROBLEM: Multiple Discord IDs on same server!`);
              problematicPlayers.push({
                ign: ign,
                server: serverName,
                issue: 'Multiple Discord IDs',
                records: serverPlayers
              });
            } else if (activeWithDiscord.length > 0 && activeWithoutDiscord.length > 0) {
              console.log(`    ⚠️ PROBLEM: Both Discord and non-Discord active records!`);
              problematicPlayers.push({
                ign: ign,
                server: serverName,
                issue: 'Mixed Discord/non-Discord active records',
                records: serverPlayers
              });
            } else if (activeWithDiscord.length > 1) {
              console.log(`    ⚠️ PROBLEM: Multiple active records with same Discord ID!`);
              problematicPlayers.push({
                ign: ign,
                server: serverName,
                issue: 'Multiple active records with same Discord ID',
                records: serverPlayers
              });
            }
          }
        }
        
        if (!hasServerDuplicates) {
          console.log(`  ✅ No server-specific duplicates (records are on different servers)`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total players with duplicates: ${totalDuplicates}`);
    console.log(`  Problematic cases: ${problematicPlayers.length}`);
    
    if (problematicPlayers.length > 0) {
      console.log(`\n🚨 Problematic Players:`);
      for (const problem of problematicPlayers) {
        console.log(`  • ${problem.ign} on ${problem.server}: ${problem.issue}`);
      }
    }
    
    // Show recent players that might be causing issues
    console.log(`\n🔍 Recent players (last 20):`);
    const [recentPlayers] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, p.linked_at, rs.nickname
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      ORDER BY p.linked_at DESC
      LIMIT 20
    `);
    
    for (const player of recentPlayers) {
      const discordInfo = player.discord_id ? `Discord=${player.discord_id}` : 'Discord=null';
      const activeInfo = player.is_active ? 'ACTIVE' : 'INACTIVE';
      const linkedInfo = player.linked_at ? new Date(player.linked_at).toLocaleString() : 'Unknown';
      console.log(`  ID=${player.id}, IGN="${player.ign}", ${discordInfo}, ${activeInfo}, Server=${player.nickname}, Linked=${linkedInfo}`);
    }
    
  } catch (error) {
    console.error('❌ Error finding duplicates:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
findAllDuplicates();
