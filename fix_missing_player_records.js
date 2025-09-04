const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMissingPlayerRecords() {
  console.log('🔧 FIXING MISSING PLAYER RECORDS');
  console.log('==================================\n');

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

    // Step 1: Use the correct database guild ID and find both servers
    console.log('📋 Step 1: Finding DeadOps and USA-DeadOps servers...\n');
    
    const guildId = 609; // Database guild ID for DEAD-OPS 10x
    console.log(`  ✅ Using database guild ID: ${guildId} (DEAD-OPS 10x)`);
    
    const [servers] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = ? AND nickname IN ("Dead-ops", "USA-DeadOps")',
      [guildId]
    );
    
    if (servers.length !== 2) {
      console.log('❌ Need exactly 2 servers (Dead-ops and USA-DeadOps)');
      console.log(`  Found ${servers.length} servers: ${servers.map(s => s.nickname).join(', ')}`);
      return;
    }
    
    const deadOpsServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaDeadOpsServer = servers.find(s => s.nickname === 'USA-DeadOps');
    
    console.log(`  ✅ Dead-ops server: ${deadOpsServer.nickname} (ID: ${deadOpsServer.id})`);
    console.log(`  ✅ USA-DeadOps server: ${usaDeadOpsServer.nickname} (ID: ${usaDeadOpsServer.id})\n`);

    // Step 2: Find all Discord users who have economy records but missing player records
    console.log('📋 Step 2: Finding players with missing records...\n');
    
    // Get all economy records for this guild
    const [economyRecords] = await connection.execute(`
      SELECT e.*, p.discord_id, p.ign, p.server_id, rs.nickname as server_name
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE e.guild_id = ?
    `, [guildId]);
    
    console.log(`  📊 Found ${economyRecords.length} economy records`);
    
    // Find players missing from either server
    const missingPlayers = [];
    
    for (const record of economyRecords) {
      if (record.discord_id) {
        // Check if player exists on Dead-ops
        const [deadOpsPlayer] = await connection.execute(
          'SELECT * FROM players WHERE server_id = ? AND discord_id = ? AND is_active = 1',
          [deadOpsServer.id, record.discord_id]
        );
        
        // Check if player exists on USA-DeadOps
        const [usaDeadOpsPlayer] = await connection.execute(
          'SELECT * FROM players WHERE server_id = ? AND discord_id = ? AND is_active = 1',
          [usaDeadOpsServer.id, record.discord_id]
        );
        
        if (deadOpsPlayer.length === 0 || usaDeadOpsPlayer.length === 0) {
          missingPlayers.push({
            discord_id: record.discord_id,
            ign: record.ign,
            missingDeadOps: deadOpsPlayer.length === 0,
            missingUsaDeadOps: usaDeadOpsPlayer.length === 0
          });
        }
      }
    }
    
    console.log(`  📊 Found ${missingPlayers.length} players with missing records\n`);

    // Step 3: Create missing player records
    console.log('📋 Step 3: Creating missing player records...\n');
    
    let createdCount = 0;
    
    for (const player of missingPlayers) {
      try {
        if (player.missingDeadOps) {
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, NOW(), 1)',
            [guildId, deadOpsServer.id, player.discord_id, player.ign]
          );
          console.log(`    ✅ Created Dead-ops record for ${player.ign}`);
          createdCount++;
        }
        
        if (player.missingUsaDeadOps) {
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, NOW(), 1)',
            [guildId, usaDeadOpsServer.id, player.discord_id, player.ign]
          );
          console.log(`    ✅ Created USA-DeadOps record for ${player.ign}`);
          createdCount++;
        }
      } catch (error) {
        console.log(`    ❌ Failed to create record for ${player.ign}: ${error.message}`);
      }
    }
    
    console.log(`\n  📊 Created ${createdCount} missing player records`);

    // Step 4: Verify all players now exist on both servers
    console.log('\n📋 Step 4: Verifying all players exist on both servers...\n');
    
    const [allDiscordUsers] = await connection.execute(`
      SELECT DISTINCT discord_id, ign 
      FROM players 
      WHERE guild_id = ? AND discord_id IS NOT NULL AND is_active = 1
    `, [guildId]);
    
    let verifiedCount = 0;
    
    for (const user of allDiscordUsers) {
      const [deadOpsCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND discord_id = ? AND is_active = 1',
        [deadOpsServer.id, user.discord_id]
      );
      
      const [usaDeadOpsCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND discord_id = ? AND is_active = 1',
        [usaDeadOpsServer.id, user.discord_id]
      );
      
      if (deadOpsCount[0].count > 0 && usaDeadOpsCount[0].count > 0) {
        verifiedCount++;
      }
    }
    
    console.log(`  ✅ Verified: ${verifiedCount}/${allDiscordUsers.length} players exist on both servers`);
    
    if (verifiedCount === allDiscordUsers.length) {
      console.log('\n🎉 SUCCESS: All players now exist on both servers!');
      console.log('✅ The bot should now be able to find all players');
      console.log('✅ /admin-link and other commands should work properly');
    } else {
      console.log('\n⚠️ WARNING: Some players still missing from one or both servers');
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
fixMissingPlayerRecords().catch(console.error);
