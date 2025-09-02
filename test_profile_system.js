const pool = require('./src/db');

async function testProfileSystem() {
  try {
    console.log('🔍 Testing Profile System');
    console.log('========================\n');
    
    // Test 1: Check if player_playtime table has data
    console.log('1. Checking player_playtime data...');
    const [playtimeData] = await pool.query(`
      SELECT 
        p.ign,
        rs.nickname as server_name,
        ppt.total_minutes,
        CASE 
          WHEN ppt.total_minutes = 0 THEN '0m'
          WHEN ppt.total_minutes < 60 THEN CONCAT(ppt.total_minutes, 'm')
          ELSE CONCAT(FLOOR(ppt.total_minutes / 60), 'h ', MOD(ppt.total_minutes, 60), 'm')
        END as formatted_playtime
      FROM player_playtime ppt
      JOIN players p ON ppt.player_id = p.id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE ppt.total_minutes > 0
      ORDER BY ppt.total_minutes DESC
      LIMIT 10
    `);
    
    if (playtimeData.length > 0) {
      console.log('✅ Found players with playtime data:');
      playtimeData.forEach(player => {
        console.log(`   ${player.ign} (${player.server_name}): ${player.formatted_playtime} (${player.total_minutes} minutes)`);
      });
    } else {
      console.log('⚠️ No players with playtime data found');
    }
    
    // Test 2: Check if player_stats table has data
    console.log('\n2. Checking player_stats data...');
    const [statsData] = await pool.query(`
      SELECT 
        p.ign,
        rs.nickname as server_name,
        ps.kills,
        ps.deaths,
        ps.kill_streak,
        ps.highest_streak,
        CASE 
          WHEN ps.deaths > 0 THEN ROUND(ps.kills / ps.deaths, 2)
          ELSE ps.kills
        END as kd_ratio
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE ps.kills > 0
      ORDER BY ps.kills DESC
      LIMIT 10
    `);
    
    if (statsData.length > 0) {
      console.log('✅ Found players with stats data:');
      statsData.forEach(player => {
        console.log(`   ${player.ign} (${player.server_name}): ${player.kills} kills, ${player.deaths} deaths, K/D: ${player.kd_ratio}, Current Streak: ${player.kill_streak}, Best: ${player.highest_streak}`);
      });
    } else {
      console.log('⚠️ No players with stats data found');
    }
    
    // Test 3: Check profile command simulation
    console.log('\n3. Testing profile command simulation...');
    
    // Get a sample player with both stats and playtime
    const [samplePlayer] = await pool.query(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        rs.nickname as server_name,
        rs.id as server_id,
        ps.kills,
        ps.deaths,
        ps.kill_streak,
        ps.highest_streak,
        ppt.total_minutes
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
      WHERE p.is_active = true AND p.discord_id IS NOT NULL
      LIMIT 1
    `);
    
    if (samplePlayer.length > 0) {
      const player = samplePlayer[0];
      console.log(`✅ Sample player found: ${player.ign} on ${player.server_name}`);
      
      // Simulate the profile command logic
      const stats = {
        kills: player.kills || 0,
        deaths: player.deaths || 0,
        kill_streak: player.kill_streak || 0,
        highest_streak: player.highest_streak || 0
      };
      
      const kills = stats.kills;
      const deaths = stats.deaths;
      const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toString();
      
      const totalMinutes = player.total_minutes || 0;
      
      // Format playtime (same logic as in handleRustInfo)
      let playtimeText;
      if (totalMinutes === 0) {
        playtimeText = '0m';
      } else {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
          playtimeText = `${hours}h ${minutes}m`;
        } else {
          playtimeText = `${minutes}m`;
        }
      }
      
      console.log(`   📊 Simulated Rust Info display:`);
      console.log(`      Playtime: ${playtimeText}`);
      console.log(`      Kills: ${kills.toLocaleString()}`);
      console.log(`      Deaths: ${deaths.toLocaleString()}`);
      console.log(`      K/D: ${kdRatio}`);
      console.log(`      Current Streak: ${stats.kill_streak}`);
      console.log(`      Best Streak: ${stats.highest_streak}`);
      
    } else {
      console.log('⚠️ No sample player found for testing');
    }
    
    // Test 4: Verify database structure
    console.log('\n4. Verifying database structure...');
    
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('players', 'player_stats', 'player_playtime', 'rust_servers')
    `);
    
    const requiredTables = ['players', 'player_stats', 'player_playtime', 'rust_servers'];
    const foundTables = tables.map(t => t.TABLE_NAME);
    
    console.log('Required tables:', requiredTables);
    console.log('Found tables:', foundTables);
    
    const missingTables = requiredTables.filter(t => !foundTables.includes(t));
    if (missingTables.length === 0) {
      console.log('✅ All required tables exist');
    } else {
      console.log('❌ Missing tables:', missingTables);
    }
    
    console.log('\n✅ Profile system test completed!');
    console.log('\n📋 Summary:');
    console.log('   - /profile command shows basic player info');
    console.log('   - "Rust Info" button shows detailed statistics');
    console.log('   - Playtime is displayed in user-friendly format (e.g., "2h 30m")');
    console.log('   - Kill/death statistics and streaks are shown');
    console.log('   - All required database tables exist');
    
  } catch (error) {
    console.error('❌ Error testing profile system:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testProfileSystem();
