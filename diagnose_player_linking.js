const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnosePlayerLinking() {
  console.log('🔍 Player Linking Diagnostic Script');
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

    // Step 1: Find the guild and servers
    console.log('📋 Step 1: Finding guild and servers...');
    
    const [guilds] = await connection.execute(`
      SELECT DISTINCT g.id, g.discord_id, g.name
      FROM guilds g
      JOIN rust_servers rs ON g.id = rs.guild_id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY g.id ASC
    `);
    
    if (guilds.length === 0) {
      console.log('❌ No guild found containing both Dead-ops and USA-DeadOps!');
      return;
    }
    
    const guildId = guilds[0].id;
    console.log(`✅ Found guild: ${guilds[0].name} (ID: ${guildId})`);
    
    // Get both servers
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id
      FROM rust_servers 
      WHERE guild_id = ? AND nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY nickname
    `, [guildId]);

    if (servers.length < 2) {
      console.log('❌ Not all servers found!');
      return;
    }

    const mainServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaServer = servers.find(s => s.nickname === 'USA-DeadOps');

    console.log(`✅ Main server: ${mainServer.nickname} (ID: ${mainServer.id})`);
    console.log(`✅ USA server: ${usaServer.nickname} (ID: ${usaServer.id})`);

    // Step 2: Check player counts on each server
    console.log('\n📋 Step 2: Checking player counts...');
    
    const [mainServerPlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true
    `, [mainServer.id]);

    const [usaServerPlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true
    `, [usaServer.id]);

    console.log(`📊 Main server (${mainServer.nickname}): ${mainServerPlayers[0].count} players`);
    console.log(`📊 USA server (${usaServer.nickname}): ${usaServerPlayers[0].count} players`);

    // Step 3: Check for players that exist on USA but not on main
    console.log('\n📋 Step 3: Finding players missing from main server...');
    
    const [missingPlayers] = await connection.execute(`
      SELECT p.discord_id, p.ign, p.server_id
      FROM players p
      WHERE p.guild_id = ? 
      AND p.server_id = ? 
      AND p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM players p2 
        WHERE p2.guild_id = p.guild_id 
        AND p2.discord_id = p.discord_id 
        AND p2.server_id = ? 
        AND p2.is_active = true
      )
    `, [guildId, usaServer.id, mainServer.id]);

    console.log(`🔍 Found ${missingPlayers.length} players that exist on USA server but NOT on main server`);

    if (missingPlayers.length > 0) {
      console.log('\n📝 Players missing from main server:');
      missingPlayers.slice(0, 10).forEach(player => {
        console.log(`   - ${player.ign} (Discord: ${player.discord_id})`);
      });
      
      if (missingPlayers.length > 10) {
        console.log(`   ... and ${missingPlayers.length - 10} more`);
      }
    }

    // Step 4: Check for players that exist on main but not on USA
    console.log('\n📋 Step 4: Finding players missing from USA server...');
    
    const [missingFromUsa] = await connection.execute(`
      SELECT p.discord_id, p.ign, p.server_id
      FROM players p
      WHERE p.guild_id = ? 
      AND p.server_id = ? 
      AND p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM players p2 
        WHERE p2.guild_id = p.guild_id 
        AND p2.discord_id = p.discord_id 
        AND p2.server_id = ? 
        AND p2.is_active = true
      )
    `, [guildId, mainServer.id, usaServer.id]);

    console.log(`🔍 Found ${missingFromUsa.length} players that exist on main server but NOT on USA server`);

    if (missingFromUsa.length > 0) {
      console.log('\n📝 Players missing from USA server:');
      missingFromUsa.slice(0, 10).forEach(player => {
        console.log(`   - ${player.ign} (Discord: ${player.discord_id})`);
      });
      
      if (missingFromUsa.length > 10) {
        console.log(`   ... and ${missingFromUsa.length - 10} more`);
      }
    }

    // Step 5: Check economy records
    console.log('\n📋 Step 5: Checking economy records...');
    
    const [mainEconomy] = await connection.execute(`
      SELECT COUNT(*) as count FROM economy e
      JOIN players p ON e.player_id = p.id
      WHERE p.server_id = ? AND p.is_active = true
    `, [mainServer.id]);

    const [usaEconomy] = await connection.execute(`
      SELECT COUNT(*) as count FROM economy e
      JOIN players p ON e.player_id = p.id
      WHERE p.server_id = ? AND p.is_active = true
    `, [usaServer.id]);

    console.log(`💰 Main server economy records: ${mainEconomy[0].count}`);
    console.log(`💰 USA server economy records: ${usaEconomy[0].count}`);

    // Step 6: Recommendations
    console.log('\n📋 Step 6: Recommendations...');
    
    if (missingPlayers.length > 0) {
      console.log(`🔧 ACTION NEEDED: Run auto-linking to add ${missingPlayers.length} players to main server`);
      console.log(`   Command: /auto-link-players target_server:Dead-ops`);
    } else {
      console.log(`✅ All players are properly linked to both servers`);
    }

    if (missingFromUsa.length > 0) {
      console.log(`🔧 ACTION NEEDED: Run auto-linking to add ${missingFromUsa.length} players to USA server`);
      console.log(`   Command: /auto-link-players target_server:USA-DeadOps`);
    }

    if (mainServerPlayers[0].count === 0) {
      console.log(`✅ Main server is empty - safe to run auto-linking`);
    } else {
      console.log(`⚠️ Main server has ${mainServerPlayers[0].count} players - may need to clear first`);
    }

    if (usaServerPlayers[0].count === 0) {
      console.log(`✅ USA server is empty - safe to run auto-linking`);
    } else {
      console.log(`⚠️ USA server has ${usaServerPlayers[0].count} players - may need to clear first`);
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

diagnosePlayerLinking();
