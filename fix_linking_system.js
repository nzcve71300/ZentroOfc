const pool = require('./src/db');

async function fixLinkingSystem() {
  console.log('🔧 Fixing Linking System Issues...');
  
  try {
    // Step 1: Check current database structure
    console.log('\n📋 Step 1: Checking database structure...');
    
    // Check economy table structure
    const [economyColumns] = await pool.query('DESCRIBE economy');
    console.log('Economy table columns:');
    economyColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Check players table structure
    const [playersColumns] = await pool.query('DESCRIBE players');
    console.log('Players table columns:');
    playersColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Step 2: Fix any missing economy records
    console.log('\n📋 Step 2: Fixing missing economy records...');
    const [missingEconomy] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN economy e ON p.id = e.player_id
      WHERE p.is_active = true AND e.player_id IS NULL
    `);
    
    if (missingEconomy.length > 0) {
      console.log(`Found ${missingEconomy.length} players without economy records:`);
      missingEconomy.forEach(player => {
        console.log(`  - ${player.ign} (Discord: ${player.discord_id}) on ${player.server_name}`);
      });
      
      // Create economy records for missing players
      for (const player of missingEconomy) {
        await pool.query(
          'INSERT INTO economy (player_id, balance) VALUES (?, 0)',
          [player.id]
        );
        console.log(`✅ Created economy record for ${player.ign}`);
      }
    } else {
      console.log('✅ All players have economy records');
    }
    
    // Step 3: Clean up any duplicate or conflicting records
    console.log('\n📋 Step 3: Cleaning up duplicate records...');
    
    // Remove duplicate active players with same IGN on same server
    const [duplicateIgnResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.ign = p2.ign 
      AND p1.is_active = true 
      AND p2.is_active = true
    `);
    console.log(`Removed ${duplicateIgnResult.affectedRows} duplicate IGN records`);
    
    // Remove duplicate active players with same Discord ID on same server
    const [duplicateDiscordResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.discord_id = p2.discord_id 
      AND p1.discord_id IS NOT NULL
      AND p2.discord_id IS NOT NULL
      AND p1.is_active = true 
      AND p2.is_active = true
    `);
    console.log(`Removed ${duplicateDiscordResult.affectedRows} duplicate Discord ID records`);
    
    // Step 4: Create missing player_stats records
    console.log('\n📋 Step 4: Creating missing player_stats records...');
    const [missingStats] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE p.is_active = true AND ps.player_id IS NULL
    `);
    
    if (missingStats.length > 0) {
      console.log(`Found ${missingStats.length} players without stats records:`);
      for (const player of missingStats) {
        await pool.query(`
          INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak) 
          VALUES (?, 0, 0, 0, 0)
        `, [player.id]);
        console.log(`✅ Created stats record for ${player.ign}`);
      }
    } else {
      console.log('✅ All players have stats records');
    }
    
    // Step 5: Create missing player_playtime records
    console.log('\n📋 Step 5: Creating missing player_playtime records...');
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
          INSERT INTO player_playtime (player_id, total_minutes) 
          VALUES (?, 0)
        `, [player.id]);
        console.log(`✅ Created playtime record for ${player.ign}`);
      }
    } else {
      console.log('✅ All players have playtime records');
    }
    
    // Step 6: Show summary
    console.log('\n📋 Step 6: Summary...');
    const [totalPlayers] = await pool.query('SELECT COUNT(*) as count FROM players WHERE is_active = true');
    const [totalEconomy] = await pool.query('SELECT COUNT(*) as count FROM economy');
    const [totalStats] = await pool.query('SELECT COUNT(*) as count FROM player_stats');
    const [totalPlaytime] = await pool.query('SELECT COUNT(*) as count FROM player_playtime');
    
    console.log(`Total active players: ${totalPlayers[0].count}`);
    console.log(`Total economy records: ${totalEconomy[0].count}`);
    console.log(`Total stats records: ${totalStats[0].count}`);
    console.log(`Total playtime records: ${totalPlaytime[0].count}`);
    
    console.log('\n✅ Linking system fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing linking system:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingSystem();
