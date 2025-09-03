const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugLeaderboard() {
  console.log('🔍 Debugging Leaderboard Query - Multi-Tenant Bot');
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

    // Test the leaderboard query across all guilds
    console.log('📋 Testing leaderboard query across all guilds...');
    
    // Get all guilds
    const [guilds] = await connection.execute(`
      SELECT id, discord_id, name FROM guilds ORDER BY id
    `);
    console.log(`Found ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      console.log(`   - ${guild.name} (ID: ${guild.id}, Discord: ${guild.discord_id})`);
    });

    if (guilds.length === 0) {
      console.log('❌ No guilds found!');
      return;
    }

    // Test each guild systematically
    for (const guild of guilds) {
      console.log(`\n🔍 Testing Guild: ${guild.name} (ID: ${guild.id})`);
      console.log('─'.repeat(50));

      // Check servers in this guild
      const [servers] = await connection.execute(`
        SELECT id, nickname FROM rust_servers WHERE guild_id = ?
      `, [guild.id]);
      
      if (servers.length === 0) {
        console.log(`   ❌ No servers found in guild ${guild.name}`);
        continue;
      }

      console.log(`   📋 Found ${servers.length} servers:`);
      servers.forEach(server => {
        console.log(`      - ${server.nickname} (ID: ${server.id})`);
      });

      // Test each server in this guild
      for (const server of servers) {
        console.log(`\n   🎯 Testing Server: ${server.nickname} (ID: ${server.id})`);
        
        // Count total players on this server
        const [playerCount] = await connection.execute(`
          SELECT COUNT(*) as total_players
          FROM players 
          WHERE guild_id = ? AND server_id = ?
        `, [guild.id, server.id]);
        
        console.log(`      📊 Total players on server: ${playerCount[0].total_players}`);

        // Count players with stats
        const [statsCount] = await connection.execute(`
          SELECT COUNT(*) as players_with_stats
          FROM players p
          JOIN player_stats ps ON p.id = ps.player_id
          WHERE p.guild_id = ? AND p.server_id = ?
        `, [guild.id, server.id]);
        
        console.log(`      📊 Players with stats: ${statsCount[0].players_with_stats}`);

        // Count players with kills
        const [killsCount] = await connection.execute(`
          SELECT COUNT(*) as players_with_kills
          FROM players p
          JOIN player_stats ps ON p.id = ps.player_id
          WHERE p.guild_id = ? AND p.server_id = ? AND ps.kills > 0
        `, [guild.id, server.id]);
        
        console.log(`      📊 Players with kills: ${killsCount[0].players_with_kills}`);

        // Test the exact leaderboard query
        const [topPlayers] = await connection.execute(
          `SELECT p.ign, p.discord_id, ps.kills, ps.deaths, ps.kill_streak, ps.highest_streak, p.linked_at,
                  COALESCE(ppt.total_minutes, 0) as total_minutes
           FROM players p
           JOIN player_stats ps ON p.id = ps.player_id
           LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
           WHERE p.guild_id = ?
           AND p.server_id = ?
           AND ps.kills > 0
           ORDER BY ps.kills DESC, ps.deaths ASC
           LIMIT 3`,
          [guild.id, server.id]
        );

        if (topPlayers.length === 0) {
          console.log(`      ❌ No players with kills found on ${server.nickname}`);
        } else {
          console.log(`      ✅ Found ${topPlayers.length} players with kills:`);
          topPlayers.forEach((player, index) => {
            const hours = Math.floor(player.total_minutes / 60);
            const minutes = player.total_minutes % 60;
            const playtimeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            console.log(`         ${index + 1}. ${player.ign}: ${player.kills} kills, ${player.deaths} deaths, ${playtimeText} playtime`);
          });
        }
      }
    }

    // Overall statistics
    console.log('\n📊 Overall Database Statistics');
    console.log('─'.repeat(50));
    
    const [totalStats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT g.id) as total_guilds,
        COUNT(DISTINCT rs.id) as total_servers,
        COUNT(DISTINCT p.id) as total_players,
        COUNT(DISTINCT ps.player_id) as players_with_stats,
        COUNT(DISTINCT ppt.player_id) as players_with_playtime
      FROM guilds g
      LEFT JOIN rust_servers rs ON g.id = rs.guild_id
      LEFT JOIN players p ON rs.id = p.server_id
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
    `);
    
    const stats = totalStats[0];
    console.log(`Total Guilds: ${stats.total_guilds}`);
    console.log(`Total Servers: ${stats.total_servers}`);
    console.log(`Total Players: ${stats.total_players}`);
    console.log(`Players with Stats: ${stats.players_with_stats}`);
    console.log(`Players with Playtime: ${stats.players_with_playtime}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugLeaderboard();
