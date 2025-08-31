const mysql = require('mysql2/promise');
require('dotenv').config();

// Test configuration
const testConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function testZorpTimer() {
  console.log('🧪 Testing Zorp Timer System...\n');
  
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection(testConfig);
    console.log('✅ Database connection successful');
    
    // Test 1: Check if setTimeout works
    console.log('\n📋 Test 1: setTimeout functionality');
    console.log('Creating a 3-second test timer...');
    
    const testPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log('✅ setTimeout is working! Timer fired after 3 seconds');
        resolve();
      }, 3000);
    });
    
    await testPromise;
    
    // Test 2: Check Zorp zones in database
    console.log('\n📋 Test 2: Database Zorp zones');
    const [zones] = await connection.execute('SELECT name, owner, delay, current_state, created_at FROM zorp_zones ORDER BY created_at DESC LIMIT 5');
    
    if (zones.length === 0) {
      console.log('❌ No Zorp zones found in database');
    } else {
      console.log(`✅ Found ${zones.length} Zorp zones:`);
      zones.forEach((zone, index) => {
        console.log(`   ${index + 1}. ${zone.name} (${zone.owner}) - Delay: ${zone.delay}min, State: ${zone.current_state}, Created: ${zone.created_at}`);
      });
    }
    
    // Test 3: Check if any zones are stuck in white state
    console.log('\n📋 Test 3: Zones stuck in white state');
    const [whiteZones] = await connection.execute('SELECT name, owner, delay, created_at FROM zorp_zones WHERE current_state = "white" ORDER BY created_at DESC');
    
    if (whiteZones.length === 0) {
      console.log('✅ No zones stuck in white state');
    } else {
      console.log(`⚠️  Found ${whiteZones.length} zones stuck in white state:`);
      whiteZones.forEach((zone, index) => {
        const createdTime = new Date(zone.created_at);
        const now = new Date();
        const minutesSinceCreation = Math.floor((now - createdTime) / (1000 * 60));
        console.log(`   ${index + 1}. ${zone.name} (${zone.owner}) - Delay: ${zone.delay}min, Created: ${minutesSinceCreation} minutes ago`);
      });
    }
    
    // Test 4: Check zorp_transition_timers table (if it exists)
    console.log('\n📋 Test 4: Transition timers table');
    try {
      const [timers] = await connection.execute('SHOW TABLES LIKE "zorp_transition_timers"');
      if (timers.length > 0) {
        const [timerData] = await connection.execute('SELECT * FROM zorp_transition_timers LIMIT 5');
        console.log(`✅ Transition timers table exists with ${timerData.length} entries`);
      } else {
        console.log('ℹ️  No transition timers table found (this is normal - timers are stored in memory)');
      }
    } catch (error) {
      console.log('ℹ️  Transition timers table does not exist (this is normal)');
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('- setTimeout: ✅ Working');
    console.log(`- Database zones: ${zones.length > 0 ? '✅ Found' : '❌ None'}`);
    console.log(`- White zones: ${whiteZones.length > 0 ? '⚠️  Stuck' : '✅ None'}`);
    
    if (whiteZones.length > 0) {
      console.log('\n🔧 Recommendations:');
      console.log('1. Check if the bot process is running');
      console.log('2. Check if there are any JavaScript errors in the bot logs');
      console.log('3. Verify that the timer creation code is being executed');
      console.log('4. Check if the bot is restarting frequently (which would clear timers)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testZorpTimer().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
