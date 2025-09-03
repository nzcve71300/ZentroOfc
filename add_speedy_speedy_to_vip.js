const mysql = require('mysql2/promise');
require('dotenv').config();

async function addSpeedySpeedyToVip() {
  console.log('🎯 Adding "speedy speedy" to VIP on Both DeadOps Servers');
  console.log('========================================================\n');

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

    // Step 1: Get both DeadOps servers
    console.log('📋 Step 1: Getting DeadOps Servers...\n');
    
    const [servers] = await connection.execute(`
      SELECT id, nickname 
      FROM rust_servers 
      WHERE nickname LIKE '%DeadOps%' OR nickname LIKE '%Dead-ops%'
      ORDER BY nickname
    `);

    if (servers.length === 0) {
      console.log('❌ No DeadOps servers found!');
      return;
    }

    console.log(`Found ${servers.length} DeadOps servers:`);
    for (const server of servers) {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    }

    // Step 2: Get "speedy speedy" player info
    console.log('\n📋 Step 2: Getting "speedy speedy" Player Info...\n');
    
    const [playerResult] = await connection.execute(`
      SELECT id, ign, discord_id, server_id
      FROM players 
      WHERE LOWER(ign) = LOWER('speedy speedy')
      ORDER BY server_id
    `);

    if (playerResult.length === 0) {
      console.log('❌ Player "speedy speedy" not found in database!');
      return;
    }

    console.log(`Found ${playerResult.length} player records for "speedy speedy":`);
    for (const player of playerResult) {
      console.log(`   - ${player.ign} on server ID: ${player.server_id} (Discord: ${player.discord_id || 'Not linked'})`);
    }

    // Step 3: Add to VIP on both servers
    console.log('\n📋 Step 3: Adding to VIP on Both Servers...\n');
    
    let addedCount = 0;
    let skippedCount = 0;

    for (const server of servers) {
      console.log(`🔍 Processing ${server.nickname}...`);
      
      // Check if already VIP on this server
      const [existingVip] = await connection.execute(`
        SELECT id FROM kit_auth 
        WHERE server_id = ? AND kitlist = 'VIPkit' 
        AND (player_name = 'speedy speedy' OR discord_id = ?)
      `, [server.id, playerResult[0].discord_id]);

      if (existingVip.length > 0) {
        console.log(`   ⚠️  Already VIP on ${server.nickname} - skipping`);
        skippedCount++;
        continue;
      }

      // Add to VIP on this server
      try {
        await connection.execute(`
          INSERT INTO kit_auth (server_id, discord_id, kitlist, kit_name, player_name)
          VALUES (?, ?, 'VIPkit', 'VIPkit', 'speedy speedy')
        `, [server.id, playerResult[0].discord_id]);

        console.log(`   ✅ Added to VIP on ${server.nickname}`);
        addedCount++;
        
      } catch (error) {
        console.log(`   ❌ Failed to add to VIP on ${server.nickname}: ${error.message}`);
      }
    }

    // Step 4: Verify VIP status
    console.log('\n📋 Step 4: Verifying VIP Status...\n');
    
    for (const server of servers) {
      console.log(`🔍 VIP Status on ${server.nickname}:`);
      
      const [vipStatus] = await connection.execute(`
        SELECT ka.*, p.ign
        FROM kit_auth ka
        LEFT JOIN players p ON ka.discord_id = p.discord_id
        WHERE ka.server_id = ? AND ka.kitlist = 'VIPkit'
        AND (ka.player_name = 'speedy speedy' OR p.ign = 'speedy speedy')
      `, [server.id]);

      if (vipStatus.length > 0) {
        console.log(`   ✅ VIP Authorized: ${vipStatus[0].player_name || vipStatus[0].ign}`);
      } else {
        console.log(`   ❌ NOT VIP Authorized`);
      }
    }

    // Step 5: Summary
    console.log('\n🎉 **VIP Addition Complete!**');
    console.log('==============================');
    console.log(`   Servers processed: ${servers.length}`);
    console.log(`   VIP entries added: ${addedCount}`);
    console.log(`   Already VIP (skipped): ${skippedCount}`);
    
    if (addedCount > 0) {
      console.log('\n✅ **"speedy speedy" is now VIP on:**');
      for (const server of servers) {
        console.log(`   - ${server.nickname}`);
      }
    }

    console.log('\n🔧 **What This Means:**');
    console.log('   - "speedy speedy" can now claim VIP kits on both servers');
    console.log('   - The bot should recognize them as VIP');
    console.log('   - No more "player not found" errors');
    console.log('   - VIP status is permanent until manually removed');

    console.log('\n🎮 **Test It:**');
    console.log('   1. Have "speedy speedy" try claiming VIP kits in-game');
    console.log('   2. Use `/add-to-kit-list` command again (should work now)');
    console.log('   3. Check if VIP kits are accessible');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

addSpeedySpeedyToVip();
