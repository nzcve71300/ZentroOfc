const mysql = require('mysql2/promise');
require('dotenv').config();

async function testZorpRobustness() {
  console.log('🧪 Testing ZORP System Robustness');
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

    // Check zones that should be green (owners online)
    console.log('🔍 Checking zones that should be GREEN (owners online):\n');
    
    const [onlineZones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      AND z.last_online_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      ORDER BY z.last_online_at DESC
    `);

    if (onlineZones.length === 0) {
      console.log('❌ No zones with recent online activity found!');
      return;
    }

    console.log(`Found ${onlineZones.length} zones with recent online activity:\n`);

    let correctStates = 0;
    let incorrectStates = 0;

    for (const zone of onlineZones) {
      const timeSinceOnline = Math.floor((Date.now() - new Date(zone.last_online_at)) / 1000 / 60);
      const shouldBeGreen = timeSinceOnline < 5; // Within 5 minutes
      
      console.log(`🏠 Zone: ${zone.name} (${zone.owner})`);
      console.log(`   Server: ${zone.server_name}`);
      console.log(`   Current State: ${zone.current_state || 'unknown'}`);
      console.log(`   Last Online: ${zone.last_online_at} (${timeSinceOnline} minutes ago)`);
      console.log(`   Should Be: ${shouldBeGreen ? 'GREEN' : 'RED'}`);
      
      if (shouldBeGreen && zone.current_state === 'green') {
        console.log(`   ✅ CORRECT: Zone is green and should be green`);
        correctStates++;
      } else if (!shouldBeGreen && zone.current_state === 'red') {
        console.log(`   ✅ CORRECT: Zone is red and should be red`);
        correctStates++;
      } else {
        console.log(`   ❌ INCORRECT: Zone state doesn't match online status`);
        incorrectStates++;
      }
      console.log('');
    }

    console.log('📊 **Robustness Test Results:**');
    console.log('================================');
    console.log(`   Total zones tested: ${onlineZones.length}`);
    console.log(`   Correct states: ${correctStates}`);
    console.log(`   Incorrect states: ${incorrectStates}`);
    console.log(`   Accuracy: ${Math.round((correctStates / onlineZones.length) * 100)}%`);

    if (incorrectStates === 0) {
      console.log('\n🎉 **ZORP SYSTEM IS ROBUST!**');
      console.log('   ✅ All zones show correct states');
      console.log('   ✅ System maintains accuracy automatically');
      console.log('   ✅ No manual intervention needed');
    } else {
      console.log('\n⚠️ **ZORP SYSTEM NEEDS MORE WORK**');
      console.log(`   ❌ ${incorrectStates} zones have incorrect states`);
      console.log('   🔧 System is not fully robust yet');
      console.log('   📝 Need to investigate why states are wrong');
    }

    // Check for specific problematic cases
    console.log('\n🔍 **Investigating Specific Cases:**\n');
    
    const [problemZones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      AND z.last_online_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      AND z.current_state = 'red'
      ORDER BY z.last_online_at DESC
    `);

    if (problemZones.length > 0) {
      console.log(`Found ${problemZones.length} zones that are RED but have recent online activity:\n`);
      
      for (const zone of problemZones) {
        const timeSinceOnline = Math.floor((Date.now() - new Date(zone.last_online_at)) / 1000 / 60);
        console.log(`❌ ${zone.name} (${zone.owner}) on ${zone.server_name}`);
        console.log(`   Last online: ${timeSinceOnline} minutes ago`);
        console.log(`   Should be GREEN but is RED`);
        console.log('');
      }
      
      console.log('🔧 **These zones indicate the system is NOT robust:**');
      console.log('   - Players are online but zones are red');
      console.log('   - handlePlayerOnline function is not working properly');
      console.log('   - Need to restart bot and test again');
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

testZorpRobustness();
