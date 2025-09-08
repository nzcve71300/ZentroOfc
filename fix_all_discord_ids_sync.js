const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAllDiscordIdsSync() {
  console.log('🔧 FIXING ALL DISCORD ID SYNC ISSUES');
  console.log('====================================');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Step 1: Find all players with mismatched Discord IDs
    console.log('\n📋 Step 1: Finding players with Discord ID mismatches...');
    
    const [mismatches] = await connection.execute(`
      SELECT 
        p.id as player_id,
        p.ign,
        p.discord_id as players_discord_id,
        p.is_active as players_active,
        rs.nickname as server_name,
        psl.discord_id as server_links_discord_id,
        psl.is_active as server_links_active
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_server_links psl ON p.ign = psl.ign AND p.server_id = psl.server_id
      WHERE p.discord_id IS NOT NULL 
      AND psl.discord_id IS NOT NULL
      AND p.discord_id != psl.discord_id
      AND p.is_active = 1
      ORDER BY p.ign, p.id
    `);

    console.log(`Found ${mismatches.length} players with Discord ID mismatches:`);
    
    if (mismatches.length > 0) {
      for (const mismatch of mismatches) {
        console.log(`  ${mismatch.ign} (ID: ${mismatch.player_id}) on ${mismatch.server_name}:`);
        console.log(`    Players table: ${mismatch.players_discord_id}`);
        console.log(`    Server links:  ${mismatch.server_links_discord_id}`);
        console.log('');
      }

      // Step 2: Update all mismatched records
      console.log('\n📋 Step 2: Updating mismatched Discord IDs...');
      
      let updatedCount = 0;
      let errorCount = 0;

      for (const mismatch of mismatches) {
        try {
          // Use the Discord ID from player_server_links (which seems to be more accurate)
          const correctDiscordId = mismatch.server_links_discord_id;
          
          await connection.execute(`
            UPDATE players 
            SET discord_id = ?
            WHERE id = ?
          `, [correctDiscordId, mismatch.player_id]);
          
          console.log(`  ✅ Updated ${mismatch.ign} (ID: ${mismatch.player_id}) to Discord ID ${correctDiscordId}`);
          updatedCount++;
          
        } catch (error) {
          console.log(`  ❌ Failed to update ${mismatch.ign} (ID: ${mismatch.player_id}): ${error.message}`);
          errorCount++;
        }
      }

      console.log(`\n📊 Update Summary:`);
      console.log(`  ✅ Successfully updated: ${updatedCount} players`);
      console.log(`  ❌ Failed updates: ${errorCount} players`);

    } else {
      console.log('✅ No Discord ID mismatches found!');
    }

    // Step 3: Find players with NULL Discord IDs in players table but have them in server_links
    console.log('\n📋 Step 3: Finding players with NULL Discord IDs in players table...');
    
    const [nullDiscordIds] = await connection.execute(`
      SELECT 
        p.id as player_id,
        p.ign,
        p.discord_id as players_discord_id,
        rs.nickname as server_name,
        psl.discord_id as server_links_discord_id
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_server_links psl ON p.ign = psl.ign AND p.server_id = psl.server_id
      WHERE p.discord_id IS NULL 
      AND psl.discord_id IS NOT NULL
      AND p.is_active = 1
      ORDER BY p.ign, p.id
    `);

    console.log(`Found ${nullDiscordIds.length} players with NULL Discord IDs in players table:`);
    
    if (nullDiscordIds.length > 0) {
      for (const nullRecord of nullDiscordIds) {
        console.log(`  ${nullRecord.ign} (ID: ${nullRecord.player_id}) on ${nullRecord.server_name}:`);
        console.log(`    Players table: NULL`);
        console.log(`    Server links:  ${nullRecord.server_links_discord_id}`);
        console.log('');
      }

      // Step 4: Update NULL Discord IDs
      console.log('\n📋 Step 4: Updating NULL Discord IDs...');
      
      let nullUpdatedCount = 0;
      let nullErrorCount = 0;

      for (const nullRecord of nullDiscordIds) {
        try {
          const correctDiscordId = nullRecord.server_links_discord_id;
          
          await connection.execute(`
            UPDATE players 
            SET discord_id = ?
            WHERE id = ?
          `, [correctDiscordId, nullRecord.player_id]);
          
          console.log(`  ✅ Updated ${nullRecord.ign} (ID: ${nullRecord.player_id}) to Discord ID ${correctDiscordId}`);
          nullUpdatedCount++;
          
        } catch (error) {
          console.log(`  ❌ Failed to update ${nullRecord.ign} (ID: ${nullRecord.player_id}): ${error.message}`);
          nullErrorCount++;
        }
      }

      console.log(`\n📊 NULL Update Summary:`);
      console.log(`  ✅ Successfully updated: ${nullUpdatedCount} players`);
      console.log(`  ❌ Failed updates: ${nullErrorCount} players`);
    } else {
      console.log('✅ No NULL Discord IDs found!');
    }

    // Step 5: Final verification
    console.log('\n📋 Step 5: Final verification...');
    
    const [finalMismatches] = await connection.execute(`
      SELECT 
        p.id as player_id,
        p.ign,
        p.discord_id as players_discord_id,
        rs.nickname as server_name,
        psl.discord_id as server_links_discord_id
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_server_links psl ON p.ign = psl.ign AND p.server_id = psl.server_id
      WHERE p.discord_id IS NOT NULL 
      AND psl.discord_id IS NOT NULL
      AND p.discord_id != psl.discord_id
      AND p.is_active = 1
    `);

    if (finalMismatches.length === 0) {
      console.log('🎉 SUCCESS: All Discord IDs are now synchronized!');
    } else {
      console.log(`⚠️ WARNING: ${finalMismatches.length} Discord ID mismatches still remain`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
if (require.main === module) {
  fixAllDiscordIdsSync()
    .then(() => {
      console.log('\n✅ All Discord ID sync fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ All Discord ID sync fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllDiscordIdsSync };
