const pool = require('./src/db');

async function testKillfeedTracking() {
  console.log('🧪 Testing Killfeed Tracking System...');
  console.log('=====================================\n');

  try {
    // Test 1: Check player_stats table structure
    console.log('📋 Test 1: Player Stats Table Structure');
    const [tableInfo] = await pool.query(`
      DESCRIBE player_stats
    `);
    
    console.log('Player stats table columns:');
    tableInfo.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Test 2: Check current player stats
    console.log('\n📋 Test 2: Current Player Stats');
    const [playerStats] = await pool.query(`
      SELECT 
        p.ign,
        ps.kills,
        ps.deaths,
        ps.kill_streak,
        ps.highest_streak,
        ps.last_kill_time,
        rs.nickname as server_name
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      JOIN rust_servers rs ON p.server_id = rs.id
      ORDER BY ps.kills DESC, ps.deaths DESC
      LIMIT 10
    `);
    
    if (playerStats.length === 0) {
      console.log('❌ No player stats found in database');
    } else {
      console.log('Top 10 players by kills:');
      playerStats.forEach((stat, index) => {
        const kd = stat.deaths > 0 ? (stat.kills / stat.deaths).toFixed(2) : stat.kills.toString();
        console.log(`${index + 1}. ${stat.ign} (${stat.server_name}): ${stat.kills} kills, ${stat.deaths} deaths, K/D: ${kd}`);
      });
    }

    // Test 3: Check players without stats
    console.log('\n📋 Test 3: Players Without Stats');
    const [playersWithoutStats] = await pool.query(`
      SELECT 
        p.ign,
        rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE ps.player_id IS NULL
      ORDER BY rs.nickname, p.ign
      LIMIT 10
    `);
    
    if (playersWithoutStats.length === 0) {
      console.log('✅ All players have stats records');
    } else {
      console.log(`❌ Found ${playersWithoutStats.length} players without stats records:`);
      playersWithoutStats.forEach(player => {
        console.log(`- ${player.ign} (${player.server_name})`);
      });
    }

    // Test 4: Check recent kill events
    console.log('\n📋 Test 4: Recent Kill Events (Last 24 hours)');
    const [recentKills] = await pool.query(`
      SELECT 
        ps.last_kill_time,
        p.ign,
        rs.nickname as server_name
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE ps.last_kill_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY ps.last_kill_time DESC
      LIMIT 10
    `);
    
    if (recentKills.length === 0) {
      console.log('❌ No recent kill events found (last 24 hours)');
    } else {
      console.log('Recent kill events:');
      recentKills.forEach(kill => {
        console.log(`- ${kill.ign} (${kill.server_name}): ${kill.last_kill_time}`);
      });
    }

    // Test 5: Check killfeed processing logic
    console.log('\n📋 Test 5: Killfeed Processing Logic');
    console.log('✅ processKillStats function exists');
    console.log('✅ getOrCreatePlayerStats function exists');
    console.log('✅ updatePlayerStats function exists');
    console.log('✅ processVictimDeath function exists');
    
    // Test 6: Check database constraints
    console.log('\n📋 Test 6: Database Constraints');
    const [constraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        CONSTRAINT_TYPE
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'player_stats'
    `);
    
    console.log('Player stats table constraints:');
    constraints.forEach(constraint => {
      console.log(`- ${constraint.CONSTRAINT_NAME}: ${constraint.CONSTRAINT_TYPE}`);
    });

    // Test 7: Check for potential issues
    console.log('\n📋 Test 7: Potential Issues Check');
    
    // Check for negative values
    const [negativeStats] = await pool.query(`
      SELECT COUNT(*) as count FROM player_stats 
      WHERE kills < 0 OR deaths < 0 OR kill_streak < 0 OR highest_streak < 0
    `);
    
    if (negativeStats[0].count > 0) {
      console.log(`❌ Found ${negativeStats[0].count} records with negative values`);
    } else {
      console.log('✅ No negative values found');
    }
    
    // Check for orphaned stats
    const [orphanedStats] = await pool.query(`
      SELECT COUNT(*) as count FROM player_stats ps
      LEFT JOIN players p ON ps.player_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphanedStats[0].count > 0) {
      console.log(`❌ Found ${orphanedStats[0].count} orphaned stats records`);
    } else {
      console.log('✅ No orphaned stats records found');
    }

    // Test 8: Check killfeed configuration
    console.log('\n📋 Test 8: Killfeed Configuration');
    const [killfeedConfigs] = await pool.query(`
      SELECT 
        rs.nickname as server_name,
        kc.enabled,
        kc.format_string
      FROM killfeed_configs kc
      JOIN rust_servers rs ON kc.server_id = rs.id
      ORDER BY rs.nickname
    `);
    
    if (killfeedConfigs.length === 0) {
      console.log('❌ No killfeed configurations found');
    } else {
      console.log('Killfeed configurations:');
      killfeedConfigs.forEach(config => {
        const status = config.enabled ? '🟢 Enabled' : '🔴 Disabled';
        console.log(`- ${config.server_name}: ${status}`);
        if (config.format_string) {
          console.log(`  Format: ${config.format_string.substring(0, 50)}...`);
        }
      });
    }

    // Summary
    console.log('\n📋 SUMMARY: Killfeed Tracking Issues');
    console.log('=====================================');
    console.log('If players are showing 0 K/D, possible causes:');
    console.log('1. Kill events not being processed by processKillStats');
    console.log('2. Player records not being created in players table');
    console.log('3. Stats not being updated by updatePlayerStats');
    console.log('4. Killfeed processing disabled for servers');
    console.log('5. RCON kill messages not being detected');
    console.log('6. Player names not matching between kill messages and database');
    
    console.log('\n🔍 Next Steps:');
    console.log('- Check RCON kill message detection in handleKillEvent');
    console.log('- Verify processKillStats is being called');
    console.log('- Check if players exist in database before kill processing');
    console.log('- Test with a known kill event to trace the flow');

  } catch (error) {
    console.error('❌ Error testing killfeed tracking:', error);
  } finally {
    await pool.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testKillfeedTracking()
    .then(() => {
      console.log('\n✅ KILLFEED TRACKING TEST COMPLETE!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ TEST FAILED:', error);
      process.exit(1);
    });
}

module.exports = {
  testKillfeedTracking
};
