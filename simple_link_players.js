const mysql = require('mysql2/promise');
require('dotenv').config();

async function simpleLinkPlayers() {
  console.log('🔗 SIMPLE PLAYER LINKING: Dead-ops → USA-DeadOps');
  console.log('================================================\n');

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

    const guildId = 609; // Database guild ID for DEAD-OPS 10x
    const deadOpsServerId = '1756598716651_wmh0kflng';
    const usaDeadOpsServerId = '1756845346677_j63z09una';

    console.log('📋 Step 1: Finding players on Dead-ops server...\n');
    
    // Get all players from Dead-ops server
    const [deadOpsPlayers] = await connection.execute(`
      SELECT id, guild_id, discord_id, ign, linked_at, is_active
      FROM players 
      WHERE server_id = ? AND is_active = 1
    `, [deadOpsServerId]);
    
    console.log(`  📊 Found ${deadOpsPlayers.length} active players on Dead-ops\n`);

    console.log('📋 Step 2: Creating missing records on USA-DeadOps...\n');
    
    let createdCount = 0;
    let alreadyExistsCount = 0;
    
    for (const player of deadOpsPlayers) {
      try {
        // Check if player already exists on USA-DeadOps
        const [existingPlayer] = await connection.execute(
          'SELECT id FROM players WHERE server_id = ? AND ign = ?',
          [usaDeadOpsServerId, player.ign]
        );
        
        if (existingPlayer.length === 0) {
          // Create player record on USA-DeadOps
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, NOW(), 1)',
            [guildId, usaDeadOpsServerId, player.discord_id, player.ign]
          );
          console.log(`    ✅ Created USA-DeadOps record for ${player.ign}`);
          createdCount++;
        } else {
          console.log(`    ⚠️ ${player.ign} already exists on USA-DeadOps`);
          alreadyExistsCount++;
        }
      } catch (error) {
        console.log(`    ❌ Failed to create record for ${player.ign}: ${error.message}`);
      }
    }
    
    console.log(`\n  📊 Created ${createdCount} new records, ${alreadyExistsCount} already existed`);

    console.log('\n📋 Step 3: Verifying all players now exist on both servers...\n');
    
    // Count players on each server
    const [deadOpsCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = 1',
      [deadOpsServerId]
    );
    
    const [usaDeadOpsCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = 1',
      [usaDeadOpsServerId]
    );
    
    console.log(`  📊 Dead-ops server: ${deadOpsCount[0].count} players`);
    console.log(`  📊 USA-DeadOps server: ${usaDeadOpsCount[0].count} players`);
    
    if (deadOpsCount[0].count === usaDeadOpsCount[0].count) {
      console.log('\n🎉 SUCCESS: All players now exist on both servers!');
      console.log('✅ The bot should now be able to find all players');
      console.log('✅ /admin-link and other commands should work properly');
    } else {
      console.log('\n⚠️ WARNING: Player counts still don\'t match');
      console.log(`  Difference: ${Math.abs(deadOpsCount[0].count - usaDeadOpsCount[0].count)} players`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
simpleLinkPlayers().catch(console.error);
