const pool = require('./src/db');

async function checkPlayerStats() {
  try {
    console.log('🔍 Checking player stats records...');
    
    // Check if there are any players without stats records
    const [missingStats] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, rs.nickname as server_name
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_stats ps ON p.id = ps.player_id 
      WHERE ps.player_id IS NULL AND p.is_active = true
    `);
    
    if (missingStats.length > 0) {
      console.log(`📋 Found ${missingStats.length} players without stats records:`);
      missingStats.forEach(player => {
        console.log(`   - ${player.ign} (Discord: ${player.discord_id}) on ${player.server_name}`);
      });
      
      // Create stats records for these players
      console.log('🔧 Creating stats records for missing players...');
      for (const player of missingStats) {
        await pool.query(`
          INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak) 
          VALUES (?, 0, 0, 0, 0)
        `, [player.id]);
      }
      console.log('✅ Created stats records for all missing players.');
    } else {
      console.log('✅ All players have stats records.');
    }
    
    // Show some sample stats
    const [sampleStats] = await pool.query(`
      SELECT p.ign, ps.kills, ps.deaths, ps.kill_streak, ps.highest_streak
      FROM players p 
      JOIN player_stats ps ON p.id = ps.player_id 
      WHERE p.is_active = true
      LIMIT 5
    `);
    
    if (sampleStats.length > 0) {
      console.log('\n📊 Sample player stats:');
      sampleStats.forEach(player => {
        const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills.toString();
        console.log(`   - ${player.ign}: ${player.kills} kills, ${player.deaths} deaths, K/D: ${kd}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkPlayerStats();
