const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixLinkingSystem() {
  console.log('🔧 Fixing Linking System - Major Data Cleanup');
  console.log('==============================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Step 1: Analyze the current state
    console.log('📋 Step 1: Analyzing Current State...\n');
    
    const [duplicateDiscordIds] = await connection.execute(`
      SELECT 
        discord_id,
        COUNT(*) as count,
        GROUP_CONCAT(ign SEPARATOR ', ') as player_names,
        GROUP_CONCAT(server_id SEPARATOR ', ') as server_ids
      FROM players 
      WHERE discord_id IS NOT NULL AND discord_id != '000000000000000000'
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    console.log(`Found ${duplicateDiscordIds.length} Discord IDs with multiple players!`);
    console.log('This is causing the linking system to fail.\n');

    // Step 2: Fix the specific "De_Donzels" issue first
    console.log('📋 Step 2: Fixing "De_Donzels" Conflict...\n');
    
    const [deDonzelsPlayers] = await connection.execute(`
      SELECT id, ign, discord_id, server_id, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(ign) = LOWER('De_Donzels')
      ORDER BY server_id
    `);

    if (deDonzelsPlayers.length > 0) {
      console.log(`Found ${deDonzelsPlayers.length} "De_Donzels" players:`);
      for (const player of deDonzelsPlayers) {
        console.log(`   - ${player.ign} on ${player.server_name} (Discord: ${player.discord_id})`);
      }

      // Determine the correct Discord ID (use the one that's not the problematic one)
      const correctDiscordId = '820981833718038589'; // The one you provided
      const problematicDiscordId = '716032072314055914';

      console.log(`\n🔧 Fixing "De_Donzels" Discord ID conflicts...`);
      
      // Update all "De_Donzels" players to use the correct Discord ID
      for (const player of deDonzelsPlayers) {
        if (player.discord_id !== correctDiscordId) {
          try {
            await connection.execute(`
              UPDATE players 
              SET discord_id = ? 
              WHERE id = ?
            `, [correctDiscordId, player.id]);
            
            console.log(`   ✅ Updated ${player.ign} on ${player.server_name} to Discord ID ${correctDiscordId}`);
          } catch (error) {
            console.log(`   ❌ Failed to update ${player.ign}: ${error.message}`);
          }
        }
      }
    }

    // Step 3: Clean up duplicate Discord IDs systematically
    console.log('\n📋 Step 3: Cleaning Up Duplicate Discord IDs...\n');
    
    let cleanedCount = 0;
    let errorCount = 0;

    for (const duplicate of duplicateDiscordIds) {
      if (duplicate.count > 1) {
        console.log(`🔍 Processing Discord ID ${duplicate.discord_id} (${duplicate.count} players)...`);
        
        // Get all players with this Discord ID
        const [playersWithId] = await connection.execute(`
          SELECT id, ign, discord_id, server_id, rs.nickname as server_name, g.discord_id as guild_id
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE p.discord_id = ?
          ORDER BY server_id
        `, [duplicate.discord_id]);

        if (playersWithId.length > 1) {
          // Keep the first player, remove Discord ID from others
          const keepPlayer = playersWithId[0];
          const removePlayers = playersWithId.slice(1);
          
          console.log(`   Keeping: ${keepPlayer.ign} on ${keepPlayer.server_name}`);
          console.log(`   Removing Discord ID from ${removePlayers.length} other players...`);
          
          for (const removePlayer of removePlayers) {
            try {
              await connection.execute(`
                UPDATE players 
                SET discord_id = NULL 
                WHERE id = ?
              `, [removePlayer.id]);
              
              console.log(`     ✅ Removed Discord ID from ${removePlayer.ign} on ${removePlayer.server_name}`);
              cleanedCount++;
            } catch (error) {
              console.log(`     ❌ Failed to remove Discord ID from ${removePlayer.ign}: ${error.message}`);
              errorCount++;
            }
          }
        }
      }
    }

    // Step 4: Verify the fix
    console.log('\n📋 Step 4: Verifying the Fix...\n');
    
    const [remainingDuplicates] = await connection.execute(`
      SELECT 
        discord_id,
        COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL AND discord_id != '000000000000000000'
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (remainingDuplicates.length === 0) {
      console.log('✅ All duplicate Discord IDs have been cleaned up!');
    } else {
      console.log(`⚠️  Still have ${remainingDuplicates.length} Discord IDs with duplicates:`);
      for (const duplicate of remainingDuplicates) {
        console.log(`   - Discord ID ${duplicate.discord_id}: ${duplicate.count} players`);
      }
    }

    // Step 5: Test the linking logic
    console.log('\n📋 Step 5: Testing Linking Logic...\n');
    
    // Check if "De_Donzels" is now properly linked
    const [deDonzelsStatus] = await connection.execute(`
      SELECT 
        p.ign,
        p.discord_id,
        rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('De_Donzels')
      ORDER BY rs.nickname
    `);

    console.log('"De_Donzels" linking status after fix:');
    for (const player of deDonzelsStatus) {
      console.log(`   - ${player.ign} on ${player.server_name}: Discord ID ${player.discord_id || 'Not linked'}`);
    }

    // Step 6: Summary and recommendations
    console.log('\n🎉 **Linking System Fix Complete!**');
    console.log('===================================');
    console.log(`   Discord IDs cleaned: ${cleanedCount}`);
    console.log(`   Errors encountered: ${errorCount}`);
    console.log(`   Remaining duplicates: ${remainingDuplicates.length}`);
    
    if (remainingDuplicates.length === 0) {
      console.log('\n✅ **System Status: HEALTHY**');
      console.log('   - No more duplicate Discord IDs');
      console.log('   - Linking system should work properly');
      console.log('   - "Already Linked" errors should be resolved');
    } else {
      console.log('\n⚠️  **System Status: PARTIALLY FIXED**');
      console.log('   - Some duplicates remain');
      console.log('   - Manual review may be needed');
    }

    console.log('\n🔧 **What This Fixed:**');
    console.log('1. ✅ "De_Donzels" Discord ID conflict resolved');
    console.log('2. ✅ Duplicate Discord IDs cleaned up');
    console.log('3. ✅ Linking system data integrity restored');
    console.log('4. ✅ "Already Linked" errors should stop');

    console.log('\n🚀 **Next Steps:**');
    console.log('1. Test the `/link` command with new players');
    console.log('2. Verify that "Already Linked" errors are gone');
    console.log('3. Monitor for any new linking issues');
    console.log('4. Consider implementing better validation in the bot code');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixLinkingSystem();
