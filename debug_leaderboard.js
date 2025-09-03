const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugLeaderboard() {
  console.log('🔍 Debugging Leaderboard Query');
  console.log('==============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Test the leaderboard query
    console.log('📋 Testing leaderboard query...');
    
    // First, let's see what guilds exist
    const [guilds] = await connection.execute(`
      SELECT id, discord_id, name FROM guilds LIMIT 5
    `);
    console.log('Guilds found:', guilds);

    if (guilds.length === 0) {
      console.log('❌ No guilds found!');
      return;
    }

    const guildId = guilds[0].id;
    console.log(`\n🔍 Testing with guild ID: ${guildId}`);

    // Test the exact query from leaderboard command
    const [topPlayers] = await connection.execute(
      `SELECT p.ign, p.discord_id, ps.kills, ps.deaths, ps.kill_streak, ps.highest_streak, p.linked_at,
              COALESCE(ppt.total_minutes, 0) as total_minutes
       FROM players p
       JOIN player_stats ps ON p.id = ps.player_id
       LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
       WHERE p.guild_id = ?
       AND ps.kills > 0
       ORDER BY ps.kills DESC, ps.deaths ASC
       LIMIT 5`,
      [guildId]
    );

    console.log(`\n📊 Found ${topPlayers.length} players with kills:`);
    topPlayers.forEach((player, index) => {
      console.log(`\n${index + 1}. ${player.ign}:`);
      console.log(`   Kills: ${player.kills}, Deaths: ${player.deaths}`);
      console.log(`   Kill Streak: ${player.kill_streak}, Best Streak: ${player.highest_streak}`);
      console.log(`   Playtime: ${player.total_minutes} minutes`);
      console.log(`   Discord ID: ${player.discord_id || 'Unlinked'}`);
    });

    // Check if playtime records exist
    console.log('\n📋 Checking playtime records...');
    const [playtimeCheck] = await connection.execute(`
      SELECT COUNT(*) as total_playtime_records
      FROM player_playtime
    `);
    console.log(`Total playtime records: ${playtimeCheck[0].total_playtime_records}`);

    // Check if player_stats records exist
    console.log('\n📋 Checking player_stats records...');
    const [statsCheck] = await connection.execute(`
      SELECT COUNT(*) as total_stats_records
      FROM player_stats
    `);
    console.log(`Total player_stats records: ${statsCheck[0].total_stats_records}`);

    // Check sample playtime data
    if (playtimeCheck[0].total_playtime_records > 0) {
      console.log('\n📋 Sample playtime data:');
      const [samplePlaytime] = await connection.execute(`
        SELECT ppt.*, p.ign
        FROM player_playtime ppt
        JOIN players p ON ppt.player_id = p.id
        LIMIT 3
      `);
      samplePlaytime.forEach(record => {
        console.log(`   ${record.ign}: ${record.total_minutes} minutes`);
      });
    }

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
