const pool = require('./src/db');

async function checkPlaytimeTable() {
  try {
    console.log('🔍 Checking if player_playtime table exists...');
    
    // Check if the table exists
    const [tableCheck] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'player_playtime'
    `);
    
    if (tableCheck[0].count === 0) {
      console.log('❌ player_playtime table does not exist. Creating it...');
      
      // Create the table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS player_playtime (
          id INT AUTO_INCREMENT PRIMARY KEY,
          player_id INT NOT NULL,
          total_minutes INT DEFAULT 0,
          last_online TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_reward TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          session_start TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_player_playtime (player_id),
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        )
      `);
      
      console.log('✅ player_playtime table created successfully!');
    } else {
      console.log('✅ player_playtime table already exists.');
    }
    
    // Check if there are any players without playtime records
    const [missingPlaytime] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id 
      FROM players p 
      LEFT JOIN player_playtime ppt ON p.id = ppt.player_id 
      WHERE ppt.player_id IS NULL AND p.is_active = true
    `);
    
    if (missingPlaytime.length > 0) {
      console.log(`📋 Found ${missingPlaytime.length} players without playtime records:`);
      missingPlaytime.forEach(player => {
        console.log(`   - ${player.ign} (Discord: ${player.discord_id})`);
      });
      
      // Create playtime records for these players
      console.log('🔧 Creating playtime records for missing players...');
      for (const player of missingPlaytime) {
        await pool.query(`
          INSERT INTO player_playtime (player_id, total_minutes) 
          VALUES (?, 0)
        `, [player.id]);
      }
      console.log('✅ Created playtime records for all missing players.');
    } else {
      console.log('✅ All players have playtime records.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkPlaytimeTable();
