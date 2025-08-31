const pool = require('./src/db');

async function fixPlaytimeRecords() {
  console.log('🔧 Fixing missing playtime records...');
  
  try {
    // Find all players without playtime records
    const [missingPlaytime] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
      WHERE p.is_active = true AND ppt.player_id IS NULL
    `);
    
    if (missingPlaytime.length > 0) {
      console.log(`Found ${missingPlaytime.length} players without playtime records:`);
      
      for (const player of missingPlaytime) {
        await pool.query(`
          INSERT INTO player_playtime (player_id, total_minutes, last_online, last_reward) 
          VALUES (?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [player.id]);
        console.log(`✅ Created playtime record for ${player.ign} (${player.server_name})`);
      }
      
      console.log(`✅ Created playtime records for ${missingPlaytime.length} players`);
    } else {
      console.log('✅ All players already have playtime records');
    }
    
    // Show summary
    const [totalPlayers] = await pool.query('SELECT COUNT(*) as count FROM players WHERE is_active = true');
    const [totalPlaytime] = await pool.query('SELECT COUNT(*) as count FROM player_playtime');
    
    console.log(`\n📊 Summary:`);
    console.log(`Total active players: ${totalPlayers[0].count}`);
    console.log(`Total playtime records: ${totalPlaytime[0].count}`);
    
  } catch (error) {
    console.error('❌ Error fixing playtime records:', error);
  } finally {
    await pool.end();
  }
}

fixPlaytimeRecords();
