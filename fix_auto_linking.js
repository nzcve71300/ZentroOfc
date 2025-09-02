const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAutoLinking() {
  console.log('🔗 Fixing Automatic Server Linking');
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

    // Step 1: Check current state
    console.log('📊 Current State Analysis:');
    console.log('--------------------------');
    
    // Get all guilds with multiple servers
    const [guildsWithMultipleServers] = await connection.execute(`
      SELECT 
        g.id as guild_id,
        g.name as guild_name,
        g.discord_id as guild_discord_id,
        COUNT(rs.id) as server_count
      FROM guilds g
      JOIN rust_servers rs ON g.id = rs.guild_id
      GROUP BY g.id
      HAVING COUNT(rs.id) > 1
      ORDER BY g.id
    `);

    console.log(`Found ${guildsWithMultipleServers.length} guilds with multiple servers:`);
    for (const guild of guildsWithMultipleServers) {
      console.log(`  Guild ${guild.guild_id} (${guild.guild_name}): ${guild.server_count} servers`);
    }

    // Step 2: For each guild, find players who need linking
    console.log('\n🔍 Finding Players Needing Auto-Linking:');
    console.log('----------------------------------------');

    for (const guild of guildsWithMultipleServers) {
      console.log(`\nProcessing Guild: ${guild.guild_name} (ID: ${guild.guild_id})`);
      
      // Get all servers in this guild
      const [servers] = await connection.execute(`
        SELECT id, nickname
        FROM rust_servers 
        WHERE guild_id = ?
        ORDER BY id
      `, [guild.guild_id]);

      if (servers.length < 2) continue;

      // For simplicity, treat the first server as the main server
      // You can modify this logic if you have a specific way to identify the main server
      const mainServer = servers[0];
      const newServers = servers.slice(1);
      
      console.log(`  Main server: ${mainServer.nickname} (ID: ${mainServer.id})`);
      console.log(`  New servers: ${newServers.map(s => s.nickname).join(', ')}`);

      // Get all players linked to the main server
      const [mainServerPlayers] = await connection.execute(`
        SELECT DISTINCT p.discord_id, p.ign, p.id as player_id
        FROM players p
        WHERE p.server_id = ? AND p.is_active = true
      `, [mainServer.id]);

      console.log(`  Players on main server: ${mainServerPlayers.length}`);

      // For each new server, check which players need linking
      for (const newServer of newServers) {
        console.log(`\n  Checking server: ${newServer.nickname}`);
        
        // Find players who are on main server but not on new server
        const [playersNeedingLink] = await connection.execute(`
          SELECT 
            mp.discord_id,
            mp.ign,
            mp.id as player_id,
            mp.guild_id,
            mp.is_active
          FROM players mp
          WHERE mp.server_id = ? AND mp.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM players np 
            WHERE np.server_id = ? 
            AND np.discord_id = mp.discord_id 
            AND np.is_active = true
          )
        `, [mainServer.id, newServer.id]);

        console.log(`    Players needing link: ${playersNeedingLink.length}`);

        if (playersNeedingLink.length > 0) {
          // Auto-link these players to the new server
          console.log(`    Auto-linking players to ${newServer.nickname}...`);
          
          for (const player of playersNeedingLink) {
            try {
              // Debug: Show what we're trying to insert
              console.log(`      Attempting to link: guild_id=${player.guild_id}, discord_id=${player.discord_id}, ign=${player.ign}, server_id=${newServer.id}, is_active=${player.is_active}`);
              
              // Insert the player link to the new server
              await connection.execute(`
                INSERT INTO players (
                  guild_id, 
                  discord_id, 
                  ign, 
                  server_id, 
                  is_active
                ) VALUES (?, ?, ?, ?, ?)
              `, [
                player.guild_id,
                player.discord_id,
                player.ign,
                newServer.id,
                player.is_active
              ]);

              // Get the newly created player ID for economy record
              const [newPlayer] = await connection.execute(`
                SELECT id FROM players 
                WHERE guild_id = ? AND discord_id = ? AND server_id = ?
              `, [player.guild_id, player.discord_id, newServer.id]);

              if (newPlayer.length > 0) {
                // Create economy record for the new server
                await connection.execute(`
                  INSERT INTO economy (player_id, balance)
                  VALUES (?, 0)
                `, [newPlayer[0].id]);
              }

              console.log(`      ✅ Linked ${player.ign} (${player.discord_id}) to ${newServer.nickname}`);
            } catch (error) {
              console.log(`      ❌ Failed to link ${player.ign}: ${error.message}`);
              // Debug: Show the exact values that failed
              console.log(`         Values: guild_id=${player.guild_id}, discord_id=${player.discord_id}, ign=${player.ign}, server_id=${newServer.id}, is_active=${player.is_active}`);
            }
          }
        }
      }
    }

    // Step 3: Verify the fix for the specific case
    console.log('\n✅ Verification - Checking nzcve7130 on USA-DeadOps:');
    console.log('--------------------------------------------------');
    
    const [verification] = await connection.execute(`
      SELECT 
        p.*,
        rs.nickname as server_name,
        COALESCE(e.balance, 0) as balance
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN economy e ON p.id = e.player_id
      WHERE p.ign = 'nzcve7130' 
      AND rs.nickname = 'USA-DeadOps'
      AND p.is_active = true
    `);

    if (verification.length > 0) {
      console.log('✅ SUCCESS: nzcve7130 is now linked to USA-DeadOps');
      console.log(`   Player ID: ${verification[0].id}`);
      console.log(`   Balance: ${verification[0].balance}`);
    } else {
      console.log('❌ FAILED: nzcve7130 is still not linked to USA-DeadOps');
    }

    console.log('\n🎉 Auto-linking fix completed!');

  } catch (error) {
    console.error('❌ Error during auto-linking fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixAutoLinking();
