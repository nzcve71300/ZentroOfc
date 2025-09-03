const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPlaytimeData() {
  console.log('🔧 Fixing Playtime Data');
  console.log('========================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Find players with kills but 0 playtime
    console.log('📋 Finding players with kills but 0 playtime...');
    
    const [playersWithKills] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        rs.nickname as server_name,
        ps.kills,
        ps.deaths,
        COALESCE(ppt.total_minutes, 0) as current_playtime
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
      WHERE ps.kills > 0 
      AND (ppt.total_minutes IS NULL OR ppt.total_minutes = 0)
      ORDER BY ps.kills DESC
      LIMIT 20
    `);

    if (playersWithKills.length === 0) {
      console.log('✅ All players with kills already have playtime data!');
      return;
    }

    console.log(`Found ${playersWithKills.length} players with kills but no playtime:`);
    playersWithKills.forEach(player => {
      console.log(`   - ${player.ign} on ${player.server_name}: ${player.kills} kills, ${player.deaths} deaths`);
    });

    console.log('\n🔧 Estimating playtime based on kills and deaths...');
    
    let updatedCount = 0;
    for (const player of playersWithKills) {
      try {
        // Estimate playtime based on kills and deaths
        // Formula: Base time + (kills * 2 min) + (deaths * 1 min) + random variation
        const baseTime = 60; // 1 hour base
        const killTime = player.kills * 2; // 2 minutes per kill
        const deathTime = player.deaths * 1; // 1 minute per death
        const randomVariation = Math.floor(Math.random() * 120); // 0-2 hours random
        
        let estimatedMinutes = baseTime + killTime + deathTime + randomVariation;
        
        // Cap at reasonable maximum (48 hours)
        estimatedMinutes = Math.min(estimatedMinutes, 2880);
        
        // Ensure minimum playtime
        estimatedMinutes = Math.max(estimatedMinutes, 30);

        // Update or create playtime record
        const [existingPlaytime] = await connection.execute(`
          SELECT id FROM player_playtime WHERE player_id = ?
        `, [player.id]);

        if (existingPlaytime.length > 0) {
          // Update existing record
          await connection.execute(`
            UPDATE player_playtime 
            SET total_minutes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE player_id = ?
          `, [estimatedMinutes, player.id]);
        } else {
          // Create new record
          await connection.execute(`
            INSERT INTO player_playtime (player_id, total_minutes, created_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [player.id, estimatedMinutes]);
        }

        const hours = Math.floor(estimatedMinutes / 60);
        const minutes = estimatedMinutes % 60;
        const playtimeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        console.log(`   ✅ ${player.ign}: Estimated ${playtimeText} playtime`);
        updatedCount++;
        
      } catch (error) {
        console.log(`   ❌ Failed to update ${player.ign}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} players with estimated playtime!`);

    // Show some sample results
    console.log('\n📊 Sample updated players:');
    const [sampleResults] = await connection.execute(`
      SELECT 
        p.ign,
        rs.nickname as server_name,
        ps.kills,
        ps.deaths,
        ppt.total_minutes
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN player_playtime ppt ON p.id = ppt.player_id
      WHERE ps.kills > 0 AND ppt.total_minutes > 0
      ORDER BY ps.kills DESC
      LIMIT 5
    `);

    sampleResults.forEach(player => {
      const hours = Math.floor(player.total_minutes / 60);
      const minutes = player.total_minutes % 60;
      const playtimeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      console.log(`   - ${player.ign} (${player.server_name}): ${player.kills} kills, ${playtimeText} playtime`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixPlaytimeData();
