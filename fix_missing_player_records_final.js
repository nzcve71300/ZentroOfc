const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMissingPlayerRecordsFinal() {
  console.log('🔧 FIXING MISSING PLAYER RECORDS - FINAL VERSION');
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

    // Step 2: Find all unique IGNs from economy records
    console.log('📋 Step 2: Finding unique players from economy records...\n');
    
    const [economyRecords] = await connection.execute(`
      SELECT DISTINCT e.ign, e.discord_id
      FROM economy e
      WHERE e.guild_id = ?
    `, [guildId]);
    
    console.log(`  📊 Found ${economyRecords.length} unique players with economy records\n`);

    // Step 3: Check which players exist on each server and create missing ones
    console.log('📋 Step 3: Creating missing player records...\n');
    
    let createdCount = 0;
    let alreadyExistsCount = 0;
    
    for (const record of economyRecords) {
      try {
        // Check if player exists on Dead-ops
        const [deadOpsPlayer] = await connection.execute(
          'SELECT * FROM players WHERE server_id = ? AND ign = ?',
          [deadOpsServer.id, record.ign]
        );
        
        // Check if player exists on USA-DeadOps
        const [usaDeadOpsPlayer] = await connection.execute(
          'SELECT * FROM players WHERE server_id = ? AND ign = ?',
          [usaDeadOpsServer.id, record.ign]
        );
        
        // Create Dead-ops record if missing
        if (deadOpsPlayer.length === 0) {
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, NOW(), 1)',
            [guildId, deadOpsServer.id, record.discord_id, record.ign]
          );
          console.log(`    ✅ Created Dead-ops record for ${record.ign}`);
          createdCount++;
        } else {
          alreadyExistsCount++;
        }
        
        // Create USA-DeadOps record if missing
        if (usaDeadOpsPlayer.length === 0) {
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, NOW(), 1)',
            [guildId, usaDeadOpsServer.id, record.discord_id, record.ign]
          );
          console.log(`    ✅ Created USA-DeadOps record for ${record.ign}`);
          createdCount++;
        } else {
          alreadyExistsCount++;
        }
        
      } catch (error) {
        if (error.message.includes('Duplicate entry')) {
          console.log(`    ⚠️ Record already exists for ${record.ign} (duplicate constraint)`);
        } else {
          console.log(`    ❌ Failed to create record for ${record.ign}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n  📊 Created ${createdCount} new records, ${alreadyExistsCount} already existed`);

    // Step 4: Verify all players now exist on both servers
    console.log('\n📋 Step 4: Verifying all players exist on both servers...\n');
    
    const [allPlayers] = await connection.execute(`
      SELECT DISTINCT ign 
      FROM players 
      WHERE guild_id = ? AND is_active = 1
    `, [guildId]);
    
    let verifiedCount = 0;
    
    for (const player of allPlayers) {
      const [deadOpsCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND ign = ? AND is_active = 1',
        [deadOpsServer.id, player.ign]
      );
      
      const [usaDeadOpsCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND ign = ? AND is_active = 1',
        [usaDeadOpsServer.id, player.ign]
      );
      
      if (deadOpsCount[0].count > 0 && usaDeadOpsCount[0].count > 0) {
        verifiedCount++;
      }
    }
    
    console.log(`  ✅ Verified: ${verifiedCount}/${allPlayers.length} players exist on both servers`);
    
    if (verifiedCount === allPlayers.length) {
      console.log('\n🎉 SUCCESS: All players now exist on both servers!');
      console.log('✅ The bot should now be able to find all players');
      console.log('✅ /admin-link and other commands should work properly');
    } else {
      console.log('\n⚠️ WARNING: Some players still missing from one or both servers');
      console.log(`  Missing: ${allPlayers.length - verifiedCount} players`);
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
fixMissingPlayerRecordsFinal().catch(console.error);
