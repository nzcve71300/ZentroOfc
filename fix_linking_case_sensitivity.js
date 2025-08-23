const pool = require('./src/db');

async function fixLinkingCaseSensitivity() {
  console.log('🔧 Fixing linking case sensitivity issues...\n');
  
  try {
    // Step 1: Find all players with case sensitivity issues
    console.log('📋 Step 1: Finding players with case sensitivity issues...');
    
    const [allPlayers] = await pool.query(`
      SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.ign IS NOT NULL
      ORDER BY p.ign, p.discord_id
    `);
    
    console.log(`Found ${allPlayers.length} total player records`);
    
    // Group by normalized IGN to find duplicates
    const normalizedGroups = {};
    allPlayers.forEach(player => {
      const normalizedIgn = player.ign.trim().toLowerCase();
      if (!normalizedGroups[normalizedIgn]) {
        normalizedGroups[normalizedIgn] = [];
      }
      normalizedGroups[normalizedIgn].push(player);
    });
    
    // Find groups with multiple records (potential duplicates)
    const duplicateGroups = Object.entries(normalizedGroups)
      .filter(([ign, players]) => players.length > 1)
      .sort(([a], [b]) => a.localeCompare(b));
    
    console.log(`Found ${duplicateGroups.length} IGNs with potential case sensitivity issues:\n`);
    
    let totalFixed = 0;
    
    for (const [normalizedIgn, players] of duplicateGroups) {
      console.log(`🔍 Processing IGN: "${normalizedIgn}" (${players.length} records)`);
      
      // Group by Discord ID to see if same user has multiple case variations
      const discordGroups = {};
      players.forEach(player => {
        if (!discordGroups[player.discord_id]) {
          discordGroups[player.discord_id] = [];
        }
        discordGroups[player.discord_id].push(player);
      });
      
      // Process each Discord ID group
      for (const [discordId, discordPlayers] of Object.entries(discordGroups)) {
        if (discordPlayers.length > 1) {
          console.log(`  📱 Discord ID ${discordId} has ${discordPlayers.length} case variations:`);
          
          // Sort by is_active (active first), then by linked_at (newest first)
          discordPlayers.sort((a, b) => {
            if (a.is_active !== b.is_active) return b.is_active - a.is_active;
            return new Date(b.linked_at) - new Date(a.linked_at);
          });
          
          // Keep the first one (most recent active), deactivate the rest
          const keepPlayer = discordPlayers[0];
          const deactivatePlayers = discordPlayers.slice(1);
          
          console.log(`    ✅ Keeping: "${keepPlayer.ign}" (${keepPlayer.server_name}) - Active: ${keepPlayer.is_active}`);
          
          for (const deactivatePlayer of deactivatePlayers) {
            console.log(`    ❌ Deactivating: "${deactivatePlayer.ign}" (${deactivatePlayer.server_name}) - Active: ${deactivatePlayer.is_active}`);
            
            await pool.query(
              'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE id = ?',
              [deactivatePlayer.id]
            );
            totalFixed++;
          }
        }
      }
      
      // Check for IGN conflicts (same IGN linked to different Discord IDs)
      const activePlayers = players.filter(p => p.is_active);
      if (activePlayers.length > 1) {
        const uniqueDiscordIds = [...new Set(activePlayers.map(p => p.discord_id))];
        if (uniqueDiscordIds.length > 1) {
          console.log(`  ⚠️  WARNING: IGN "${normalizedIgn}" is actively linked to ${uniqueDiscordIds.length} different Discord IDs!`);
          console.log(`     Discord IDs: ${uniqueDiscordIds.join(', ')}`);
          console.log(`     This needs manual resolution by an admin.`);
        }
      }
      
      console.log('');
    }
    
    // Step 2: Normalize all IGNs to lowercase
    console.log('📋 Step 2: Normalizing all IGNs to lowercase...');
    
    const [normalizeResult] = await pool.query(`
      UPDATE players 
      SET ign = LOWER(TRIM(ign))
      WHERE ign IS NOT NULL 
      AND ign != LOWER(TRIM(ign))
    `);
    
    console.log(`✅ Normalized ${normalizeResult.affectedRows} IGNs to lowercase`);
    
    // Step 3: Clean up any remaining duplicates after normalization
    console.log('\n📋 Step 3: Cleaning up remaining duplicates after normalization...');
    
    const [duplicateResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.ign = p2.ign 
      AND p1.discord_id = p2.discord_id
      AND p1.is_active = p2.is_active
    `);
    
    console.log(`✅ Removed ${duplicateResult.affectedRows} duplicate records after normalization`);
    
    // Step 4: Verify the fix
    console.log('\n📋 Step 4: Verifying the fix...');
    
    const [verifyResult] = await pool.query(`
      SELECT COUNT(*) as total_players,
             COUNT(DISTINCT CONCAT(LOWER(TRIM(ign)), '|', discord_id, '|', server_id)) as unique_links
      FROM players 
      WHERE ign IS NOT NULL
    `);
    
    const totalPlayers = verifyResult[0].total_players;
    const uniqueLinks = verifyResult[0].unique_links;
    
    console.log(`📊 Verification Results:`);
    console.log(`   Total player records: ${totalPlayers}`);
    console.log(`   Unique links: ${uniqueLinks}`);
    console.log(`   Duplicates remaining: ${totalPlayers - uniqueLinks}`);
    
    if (totalPlayers === uniqueLinks) {
      console.log('✅ SUCCESS: No duplicates remaining!');
    } else {
      console.log('⚠️  WARNING: Some duplicates may still exist');
    }
    
    console.log(`\n🎉 Fix completed! Total records fixed: ${totalFixed + normalizeResult.affectedRows + duplicateResult.affectedRows}`);
    console.log('\n📝 Summary of changes:');
    console.log('   - Normalized all IGNs to lowercase');
    console.log('   - Removed duplicate case variations');
    console.log('   - Deactivated conflicting records');
    console.log('   - Preserved most recent active links');
    
  } catch (error) {
    console.error('❌ Error fixing case sensitivity issues:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixLinkingCaseSensitivity();
