const mysql = require('mysql2/promise');
require('dotenv').config();

async function testZorpRealtime() {
  console.log('🧪 Testing ZORP System Real-Time Behavior');
  console.log('==========================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Test 1: Check current zone health status
    console.log('📋 Test 1: Current Zone Health Status\n');
    
    const [healthStatus] = await connection.execute(`
      SELECT 
        zh.zone_name,
        zh.expected_state,
        zh.actual_state,
        zh.health_score,
        zh.issues,
        zh.last_check,
        rs.nickname as server_name
      FROM zorp_zone_health zh
      JOIN rust_servers rs ON zh.server_id = rs.id
      ORDER BY zh.health_score ASC, zh.last_check DESC
      LIMIT 10
    `);

    if (healthStatus.length === 0) {
      console.log('❌ No zone health data found!');
      return;
    }

    console.log(`Found ${healthStatus.length} zones to analyze:\n`);

    let perfectZones = 0;
    let problemZones = 0;

    for (const zone of healthStatus) {
      const status = zone.health_score === 100 ? '✅' : '❌';
      const issues = zone.issues ? JSON.parse(zone.issues) : [];
      
      console.log(`${status} Zone: ${zone.zone_name} (${zone.server_name})`);
      console.log(`   Expected: ${zone.expected_state} | Actual: ${zone.actual_state}`);
      console.log(`   Health Score: ${zone.health_score}/100`);
      console.log(`   Last Check: ${zone.last_check}`);
      
      if (issues.length > 0) {
        console.log(`   Issues:`);
        issues.forEach(issue => {
          console.log(`     - ${issue.type}: ${issue.severity} severity`);
          if (issue.expected && issue.actual) {
            console.log(`       Expected: ${issue.expected}, Actual: ${issue.actual}`);
          }
        });
      }
      
      if (zone.health_score === 100) {
        perfectZones++;
      } else {
        problemZones++;
      }
      console.log('');
    }

    console.log(`📊 Health Summary: ${perfectZones} perfect, ${problemZones} problematic\n`);

    // Test 2: Check player status vs zone states
    console.log('📋 Test 2: Player Status vs Zone States\n');
    
    const [playerZoneMismatches] = await connection.execute(`
      SELECT 
        ps.player_name,
        ps.is_online,
        ps.last_seen,
        ps.zone_name,
        rs.nickname as server_name,
        z.current_state as zone_state,
        CASE 
          WHEN ps.is_online = 1 AND z.current_state = 'green' THEN '✅ CORRECT'
          WHEN ps.is_online = 0 AND z.current_state = 'red' THEN '✅ CORRECT'
          WHEN ps.is_online = 1 AND z.current_state != 'green' THEN '❌ MISMATCH'
          WHEN ps.is_online = 0 AND z.current_state != 'red' THEN '❌ MISMATCH'
          ELSE '❓ UNKNOWN'
        END as status
      FROM zorp_player_status ps
      JOIN rust_servers rs ON ps.server_id = rs.id
      LEFT JOIN zorp_zones z ON ps.zone_name = z.name
      ORDER BY ps.is_online DESC, ps.last_seen DESC
      LIMIT 15
    `);

    if (playerZoneMismatches.length === 0) {
      console.log('❌ No player status data found!');
      return;
    }

    console.log(`Found ${playerZoneMismatches.length} player-zone relationships:\n`);

    let correctMatches = 0;
    let mismatches = 0;

    for (const player of playerZoneMismatches) {
      const timeSinceLastSeen = Math.floor((Date.now() - new Date(player.last_seen)) / 1000 / 60);
      const status = player.status.includes('CORRECT') ? '✅' : '❌';
      
      console.log(`${status} ${player.player_name} on ${player.server_name}`);
      console.log(`   Online: ${player.is_online ? 'YES' : 'NO'}`);
      console.log(`   Zone: ${player.zone_name} (${player.zone_state})`);
      console.log(`   Last Seen: ${timeSinceLastSeen} minutes ago`);
      console.log(`   Status: ${player.status}`);
      console.log('');

      if (player.status.includes('CORRECT')) {
        correctMatches++;
      } else {
        mismatches++;
      }
    }

    console.log(`📊 Player-Zone Match Summary: ${correctMatches} correct, ${mismatches} mismatches\n`);

    // Test 3: Recent zone events
    console.log('📋 Test 3: Recent Zone Events (Last 24 Hours)\n');
    
    const [recentEvents] = await connection.execute(`
      SELECT 
        ze.zone_name,
        ze.event_type,
        ze.player_name,
        ze.timestamp,
        ze.details,
        rs.nickname as server_name
      FROM zorp_zone_events ze
      JOIN rust_servers rs ON ze.server_id = rs.id
      WHERE ze.timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY ze.timestamp DESC
      LIMIT 10
    `);

    if (recentEvents.length === 0) {
      console.log('📝 No recent zone events found in the last 24 hours');
    } else {
      console.log(`Found ${recentEvents.length} recent events:\n`);

      for (const event of recentEvents) {
        const timeAgo = Math.floor((Date.now() - new Date(event.timestamp)) / 1000 / 60);
        const details = event.details ? JSON.parse(event.details) : {};
        
        console.log(`🕐 ${event.timestamp} (${timeAgo} minutes ago)`);
        console.log(`   Zone: ${event.zone_name} (${event.server_name})`);
        console.log(`   Event: ${event.event_type}`);
        console.log(`   Player: ${event.player_name || 'N/A'}`);
        
        if (details.reason) {
          console.log(`   Reason: ${details.reason}`);
        }
        if (details.previous_state && details.new_state) {
          console.log(`   State Change: ${details.previous_state} → ${details.new_state}`);
        }
        console.log('');
      }
    }

    // Test 4: Overall system assessment
    console.log('📋 Test 4: Overall System Assessment\n');
    
    const [systemStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_zones,
        SUM(CASE WHEN health_score = 100 THEN 1 ELSE 0 END) as perfect_zones,
        SUM(CASE WHEN health_score < 100 THEN 1 ELSE 0 END) as problematic_zones,
        AVG(health_score) as avg_health_score
      FROM zorp_zone_health
    `);

    const stats = systemStats[0];
    const healthPercentage = Math.round((stats.perfect_zones / stats.total_zones) * 100);

    console.log('🏥 **System Health Report:**');
    console.log('============================');
    console.log(`   Total Zones: ${stats.total_zones}`);
    console.log(`   Perfect Zones: ${stats.perfect_zones} (${healthPercentage}%)`);
    console.log(`   Problematic Zones: ${stats.problematic_zones}`);
    console.log(`   Average Health Score: ${Math.round(stats.avg_health_score)}/100`);

    if (healthPercentage >= 90) {
      console.log('\n🎉 **System Status: EXCELLENT**');
      console.log('   Most zones are working perfectly!');
    } else if (healthPercentage >= 70) {
      console.log('\n✅ **System Status: GOOD**');
      console.log('   Most zones are working, some issues detected');
    } else if (healthPercentage >= 50) {
      console.log('\n⚠️  **System Status: FAIR**');
      console.log('   Many zones have issues, system needs attention');
    } else {
      console.log('\n❌ **System Status: POOR**');
      console.log('   Most zones have issues, system needs immediate attention');
    }

    console.log('\n🔍 **What This Tells Us:**');
    console.log('   - Zone health scores show system accuracy');
    console.log('   - Player-zone mismatches reveal logic problems');
    console.log('   - Recent events show if system is actively working');
    console.log('   - Overall health indicates system reliability');

    console.log('\n🚀 **Next Steps:**');
    console.log('   1. Restart your bot to activate enhanced logic');
    console.log('   2. Monitor these tables for real-time updates');
    console.log('   3. Check if zones automatically fix themselves');
    console.log('   4. Use health scores to identify persistent issues');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

testZorpRealtime();
