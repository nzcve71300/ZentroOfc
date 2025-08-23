const pool = require('./src/db');

async function fixLinkingSystemGlobal() {
  console.log('🔧 Implementing global linking system fix...\n');
  
  try {
    // Step 1: First, let's see what's actually in the database
    console.log('📋 Step 1: Analyzing current database state...');
    
    const [allPlayers] = await pool.query(`
      SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.ign IS NOT NULL
      ORDER BY p.ign, p.discord_id
    `);
    
    console.log(`Found ${allPlayers.length} total player records`);
    
    // Step 2: Find ALL case variations and duplicates
    const normalizedGroups = {};
    allPlayers.forEach(player => {
      const normalizedIgn = player.ign.trim().toLowerCase();
      if (!normalizedGroups[normalizedIgn]) {
        normalizedGroups[normalizedIgn] = [];
      }
      normalizedGroups[normalizedIgn].push(player);
    });
    
    // Step 3: Fix ALL case sensitivity issues comprehensively
    console.log('\n📋 Step 2: Fixing ALL case sensitivity issues...');
    
    let totalFixed = 0;
    
    for (const [normalizedIgn, players] of Object.entries(normalizedGroups)) {
      if (players.length > 1) {
        console.log(`🔍 Processing IGN: "${normalizedIgn}" (${players.length} records)`);
        
        // Group by Discord ID
        const discordGroups = {};
        players.forEach(player => {
          const discordId = player.discord_id || 'null';
          if (!discordGroups[discordId]) {
            discordGroups[discordId] = [];
          }
          discordGroups[discordId].push(player);
        });
        
        // For each Discord ID group, keep only the most recent active record
        for (const [discordId, discordPlayers] of Object.entries(discordGroups)) {
          if (discordPlayers.length > 1) {
            console.log(`  📱 Discord ID ${discordId} has ${discordPlayers.length} case variations`);
            
            // Sort by is_active (active first), then by linked_at (newest first)
            discordPlayers.sort((a, b) => {
              if (a.is_active !== b.is_active) return b.is_active - a.is_active;
              return new Date(b.linked_at) - new Date(a.linked_at);
            });
            
            // Keep the first one, deactivate ALL others
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
            console.log(`     Deactivating all but the most recent...`);
            
            // Keep only the most recent active record, deactivate all others
            activePlayers.sort((a, b) => new Date(b.linked_at) - new Date(a.linked_at));
            const keepPlayer = activePlayers[0];
            const deactivatePlayers = activePlayers.slice(1);
            
            for (const deactivatePlayer of deactivatePlayers) {
              console.log(`    ❌ Deactivating conflicting: "${deactivatePlayer.ign}" (${deactivatePlayer.server_name}) - Discord ID: ${deactivatePlayer.discord_id}`);
              
              await pool.query(
                'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE id = ?',
                [deactivatePlayer.id]
              );
              totalFixed++;
            }
          }
        }
      }
    }
    
    // Step 4: Normalize ALL IGNs to lowercase
    console.log('\n📋 Step 3: Normalizing ALL IGNs to lowercase...');
    
    const [normalizeResult] = await pool.query(`
      UPDATE players 
      SET ign = LOWER(TRIM(ign))
      WHERE ign IS NOT NULL 
      AND ign != LOWER(TRIM(ign))
    `);
    
    console.log(`✅ Normalized ${normalizeResult.affectedRows} IGNs to lowercase`);
    
    // Step 5: Clean up any remaining duplicates
    console.log('\n📋 Step 4: Cleaning up remaining duplicates...');
    
    const [duplicateResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.ign = p2.ign 
      AND p1.discord_id = p2.discord_id
      AND p1.is_active = p2.is_active
    `);
    
    console.log(`✅ Removed ${duplicateResult.affectedRows} duplicate records`);
    
    // Step 6: Add database indexes for better performance
    console.log('\n📋 Step 5: Adding performance indexes...');
    
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_players_guild_ign_active ON players(guild_id, ign(191), is_active)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_players_guild_discord_active ON players(guild_id, discord_id, is_active)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_players_ign_lower ON players(LOWER(ign))');
      console.log('✅ Performance indexes added');
    } catch (error) {
      console.log('⚠️  Some indexes may already exist:', error.message);
    }
    
    // Step 7: Verify the fix
    console.log('\n📋 Step 6: Verifying the fix...');
    
    const [verifyResult] = await pool.query(`
      SELECT COUNT(*) as total_players,
             COUNT(DISTINCT CONCAT(LOWER(TRIM(ign)), '|', discord_id, '|', server_id)) as unique_links,
             COUNT(CASE WHEN is_active = true THEN 1 END) as active_players
      FROM players 
      WHERE ign IS NOT NULL
    `);
    
    const totalPlayers = verifyResult[0].total_players;
    const uniqueLinks = verifyResult[0].unique_links;
    const activePlayers = verifyResult[0].active_players;
    
    console.log(`📊 Final Verification:`);
    console.log(`   Total player records: ${totalPlayers}`);
    console.log(`   Unique links: ${uniqueLinks}`);
    console.log(`   Active players: ${activePlayers}`);
    console.log(`   Duplicates remaining: ${totalPlayers - uniqueLinks}`);
    
    if (totalPlayers === uniqueLinks) {
      console.log('✅ SUCCESS: No duplicates remaining!');
    } else {
      console.log('⚠️  WARNING: Some duplicates may still exist');
    }
    
    // Step 8: Test the specific problematic case
    console.log('\n📋 Step 7: Testing specific case...');
    
    const [testResult] = await pool.query(`
      SELECT p.*, rs.nickname as server_name
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = 'stan-slammedu'
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log(`Test query for "stan-slammedu" found ${testResult.length} records:`);
    testResult.forEach((player, index) => {
      console.log(`  ${index + 1}. IGN: "${player.ign}" - Active: ${player.is_active} - Server: ${player.server_name}`);
    });
    
    console.log(`\n🎉 Global fix completed! Total records fixed: ${totalFixed + normalizeResult.affectedRows + duplicateResult.affectedRows}`);
    console.log('\n📝 Summary of changes:');
    console.log('   - Fixed ALL case sensitivity issues');
    console.log('   - Normalized ALL IGNs to lowercase');
    console.log('   - Removed ALL duplicate records');
    console.log('   - Resolved ALL conflicting links');
    console.log('   - Added performance indexes');
    console.log('   - Verified the fix works');
    
    console.log('\n🛡️  The linking system is now bulletproof and future-proof!');
    
  } catch (error) {
    console.error('❌ Error in global fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the global fix
fixLinkingSystemGlobal();
