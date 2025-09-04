const mysql = require('mysql2/promise');
require('dotenv').config();

async function testZorpExpiration() {
  console.log('🧪 Testing Zorp Expiration Logic\n');
  
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

    // Test 1: Check current zone states and expiration times
    console.log('📊 Test 1: Current Zone States and Expiration Times');
    const [zonesResult] = await connection.execute(`
      SELECT 
        id,
        name,
        owner,
        current_state,
        created_at,
        expire,
        delay,
        server_id,
        TIMESTAMPDIFF(MINUTE, created_at, NOW()) as minutes_since_creation,
        TIMESTAMPDIFF(MINUTE, NOW(), created_at + INTERVAL expire SECOND) as minutes_until_expiry
      FROM zorp_zones 
      WHERE current_state != 'deleted'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (zonesResult.length > 0) {
      zonesResult.forEach(zone => {
        const isExpired = zone.minutes_until_expiry < 0;
        const status = isExpired ? '❌ EXPIRED' : '✅ ACTIVE';
        console.log(`   ${status} ${zone.name} (${zone.owner})`);
        console.log(`      State: ${zone.current_state}, Created: ${zone.created_at}`);
        console.log(`      Expire: ${zone.expire} seconds (${Math.round(zone.expire/3600)} hours)`);
        console.log(`      Delay: ${zone.delay || 5} minutes, Age: ${zone.minutes_since_creation} minutes`);
        console.log(`      Time until expiry: ${zone.minutes_until_expiry} minutes`);
        console.log('');
      });
    } else {
      console.log('   No zones found');
    }

    // Test 2: Check zones that should be expired but aren't deleted
    console.log('🔍 Test 2: Zones That Should Be Expired');
    const [expiredZones] = await connection.execute(`
      SELECT 
        id,
        name,
        owner,
        current_state,
        created_at,
        expire,
        TIMESTAMPDIFF(MINUTE, created_at + INTERVAL expire SECOND, NOW()) as minutes_expired
      FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND < NOW()
        AND current_state != 'deleted'
      ORDER BY created_at + INTERVAL expire SECOND ASC
    `);

    if (expiredZones.length > 0) {
      console.log(`   Found ${expiredZones.length} zones that should be expired:`);
      expiredZones.forEach(zone => {
        console.log(`   ❌ ${zone.name} (${zone.owner}) - Expired ${zone.minutes_expired} minutes ago`);
        console.log(`      Current state: ${zone.current_state}, Should be: deleted`);
        console.log('');
      });
    } else {
      console.log('   ✅ All zones are properly managed');
    }

    // Test 3: Check zones with different delay settings
    console.log('⏰ Test 3: Zones with Different Delay Settings');
    const [delayZones] = await connection.execute(`
      SELECT 
        name,
        owner,
        current_state,
        delay,
        TIMESTAMPDIFF(MINUTE, created_at, NOW()) as minutes_since_creation
      FROM zorp_zones 
      WHERE current_state != 'deleted'
        AND delay IS NOT NULL
      ORDER BY delay DESC
      LIMIT 5
    `);

    if (delayZones.length > 0) {
      delayZones.forEach(zone => {
        console.log(`   ${zone.name} (${zone.owner})`);
        console.log(`      State: ${zone.current_state}, Delay: ${zone.delay} minutes`);
        console.log(`      Age: ${zone.minutes_since_creation} minutes`);
        console.log('');
      });
    } else {
      console.log('   No zones with custom delay settings found');
    }

    // Test 4: Validate expiration logic
    console.log('🧮 Test 4: Expiration Logic Validation');
    const testZone = zonesResult[0];
    if (testZone) {
      const createdTime = new Date(testZone.created_at).getTime();
      const expireTime = createdTime + (testZone.expire * 1000);
      const currentTime = Date.now();
      const isExpired = currentTime > expireTime;
      
      console.log(`   Testing zone: ${testZone.name}`);
      console.log(`   Created: ${new Date(createdTime).toISOString()}`);
      console.log(`   Expire: ${new Date(expireTime).toISOString()}`);
      console.log(`   Current: ${new Date(currentTime).toISOString()}`);
      console.log(`   Is Expired: ${isExpired ? 'Yes' : 'No'}`);
      console.log(`   Minutes until expiry: ${Math.round((expireTime - currentTime) / (1000 * 60))}`);
    }

    console.log('\n🎯 Summary:');
    console.log(`   • Total zones checked: ${zonesResult.length}`);
    console.log(`   • Expired zones: ${expiredZones.length}`);
    console.log(`   • Zones with custom delays: ${delayZones.length}`);
    
    if (expiredZones.length > 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   Run the improved Zorp system to clean up expired zones:');
      console.log('   node improved_zorp_system.js');
    } else {
      console.log('\n✅ All zones are properly managed!');
    }

  } catch (error) {
    console.error('❌ Error testing expiration logic:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testZorpExpiration();
