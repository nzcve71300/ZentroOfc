const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkLinkingHealth() {
  console.log('🏥 Checking Linking System Health');
  console.log('==================================\n');

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

    // Check 1: Current duplicate count
    console.log('📋 Check 1: Current Duplicate Discord IDs...\n');
    
    const [duplicates] = await connection.execute(`
      SELECT 
        discord_id,
        guild_id,
        COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL AND discord_id != '000000000000000000'
      GROUP BY discord_id, guild_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate Discord IDs found - System is healthy!');
    } else {
      console.log(`⚠️  Found ${duplicates.length} Discord IDs with duplicates:`);
      for (const duplicate of duplicates.slice(0, 5)) { // Show first 5
        console.log(`   - Discord ID ${duplicate.discord_id} in guild ${duplicate.guild_id}: ${duplicate.count} players`);
      }
      if (duplicates.length > 5) {
        console.log(`   ... and ${duplicates.length - 5} more`);
      }
    }

    // Check 2: Monitoring table status
    console.log('\n📋 Check 2: Monitoring Table Status...\n');
    
    const [monitorStatus] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        MAX(detected_at) as last_detected,
        MAX(resolved_at) as last_resolved
      FROM linking_monitor 
      GROUP BY status
    `);

    if (monitorStatus.length === 0) {
      console.log('ℹ️  No monitoring records found');
    } else {
      for (const status of monitorStatus) {
        if (status.status === 'detected') {
          console.log(`⚠️  ${status.count} issues currently detected (last: ${status.last_detected})`);
        } else {
          console.log(`✅ ${status.count} issues resolved (last: ${status.last_resolved})`);
        }
      }
    }

    // Check 3: Test validation function
    console.log('\n📋 Check 3: Testing Validation Function...\n');
    
    try {
      const [testResult] = await connection.execute(`
        SELECT validate_player_link(999999999, 'test_guild') as is_valid
      `);
      console.log('✅ Validation function is working');
    } catch (error) {
      console.log(`❌ Validation function error: ${error.message}`);
    }

    // Check 4: Event scheduler status
    console.log('\n📋 Check 4: Event Scheduler Status...\n');
    
    try {
      const [schedulerStatus] = await connection.execute(`
        SHOW VARIABLES LIKE 'event_scheduler'
      `);
      
      if (schedulerStatus.length > 0 && schedulerStatus[0].Value === 'ON') {
        console.log('✅ Event scheduler is enabled');
      } else {
        console.log('⚠️  Event scheduler is disabled');
      }
    } catch (error) {
      console.log(`⚠️  Could not check event scheduler: ${error.message}`);
    }

    // Check 5: Recent linking activity
    console.log('\n📋 Check 5: Recent Linking Activity...\n');
    
    const [recentActivity] = await connection.execute(`
      SELECT 
        COUNT(*) as total_players,
        COUNT(discord_id) as linked_players,
        COUNT(*) - COUNT(discord_id) as unlinked_players
      FROM players 
      WHERE is_active = true
    `);

    if (recentActivity.length > 0) {
      const stats = recentActivity[0];
      const linkRate = ((stats.linked_players / stats.total_players) * 100).toFixed(1);
      console.log(`📊 Player Linking Statistics:`);
      console.log(`   Total active players: ${stats.total_players}`);
      console.log(`   Linked players: ${stats.linked_players}`);
      console.log(`   Unlinked players: ${stats.unlinked_players}`);
      console.log(`   Link rate: ${linkRate}%`);
    }

    // Check 6: System health summary
    console.log('\n📋 Check 6: System Health Summary...\n');
    
    const healthScore = duplicates.length === 0 ? 100 : Math.max(0, 100 - (duplicates.length * 10));
    
    if (healthScore >= 90) {
      console.log('🟢 **SYSTEM HEALTH: EXCELLENT**');
      console.log(`   Health Score: ${healthScore}/100`);
      console.log('   No issues detected');
    } else if (healthScore >= 70) {
      console.log('🟡 **SYSTEM HEALTH: GOOD**');
      console.log(`   Health Score: ${healthScore}/100`);
      console.log('   Minor issues detected');
    } else {
      console.log('🔴 **SYSTEM HEALTH: NEEDS ATTENTION**');
      console.log(`   Health Score: ${healthScore}/100`);
      console.log('   Issues detected - consider running auto-fix');
    }

    // Recommendations
    console.log('\n💡 **Recommendations:**');
    console.log('======================');
    
    if (duplicates.length > 0) {
      console.log('1. 🔧 Run auto-fix procedure: CALL auto_fix_linking_duplicates();');
      console.log('2. 🔍 Investigate root cause of duplicates');
      console.log('3. 📊 Monitor linking_monitor table for patterns');
    } else {
      console.log('1. ✅ System is healthy - continue monitoring');
      console.log('2. 📊 Check linking_monitor table periodically');
      console.log('3. 🔄 Run this health check weekly');
    }

    console.log('\n🛠️ **Quick Commands:**');
    console.log('=====================');
    console.log('• Check duplicates: SELECT discord_id, COUNT(*) FROM players WHERE discord_id IS NOT NULL GROUP BY discord_id HAVING COUNT(*) > 1;');
    console.log('• Auto-fix: CALL auto_fix_linking_duplicates();');
    console.log('• Monitor status: SELECT * FROM linking_monitor WHERE status = "detected";');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

checkLinkingHealth();
