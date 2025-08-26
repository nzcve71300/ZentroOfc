const mysql = require('mysql2/promise');
require('dotenv').config();

async function testTeleportDatabase() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🧪 Testing Teleport Database Queries...\n');

    // Test 1: Check if teleport_configs table exists and has data
    console.log('📋 Test 1: Checking teleport_configs table...');
    const [configs] = await connection.execute('SELECT COUNT(*) as count FROM teleport_configs');
    console.log(`   Total teleport configs: ${configs[0].count}`);

    // Test 2: Check if teleport_banned_users table exists and has data
    console.log('\n🚫 Test 2: Checking teleport_banned_users table...');
    const [banned] = await connection.execute('SELECT COUNT(*) as count FROM teleport_banned_users');
    console.log(`   Total banned users: ${banned[0].count}`);

    // Test 3: Check if teleport_allowed_users table exists and has data
    console.log('\n✅ Test 3: Checking teleport_allowed_users table...');
    const [allowed] = await connection.execute('SELECT COUNT(*) as count FROM teleport_allowed_users');
    console.log(`   Total allowed users: ${allowed[0].count}`);

    // Test 4: Check a specific teleport config
    console.log('\n🔍 Test 4: Checking specific teleport config...');
    const [specificConfig] = await connection.execute(
      'SELECT * FROM teleport_configs WHERE teleport_name = ? LIMIT 1',
      ['tpe']
    );
    
    if (specificConfig.length > 0) {
      const config = specificConfig[0];
      console.log(`   Found TPE config:`);
      console.log(`     - Server ID: ${config.server_id}`);
      console.log(`     - Enabled: ${config.enabled}`);
      console.log(`     - Use List: ${config.use_list}`);
      console.log(`     - Use Kit: ${config.use_kit}`);
      console.log(`     - Kit Name: ${config.kit_name}`);
    } else {
      console.log('   No TPE config found');
    }

    // Test 5: Check if we can update a config
    console.log('\n✏️  Test 5: Testing config update...');
    const testServerId = '1754071898933_jg45hm1wj'; // Emperor 3x
    const testTeleport = 'tpe';
    
    // Get current value
    const [currentValue] = await connection.execute(
      'SELECT use_list FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
      [testServerId, testTeleport]
    );
    
    if (currentValue.length > 0) {
      const current = currentValue[0].use_list;
      console.log(`   Current use_list for ${testTeleport}: ${current}`);
      
      // Toggle the value
      const newValue = !current;
      await connection.execute(
        'UPDATE teleport_configs SET use_list = ? WHERE server_id = ? AND teleport_name = ?',
        [newValue, testServerId, testTeleport]
      );
      
      console.log(`   Updated use_list to: ${newValue}`);
      
      // Verify the update
      const [verifyValue] = await connection.execute(
        'SELECT use_list FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
        [testServerId, testTeleport]
      );
      
      console.log(`   Verified use_list is now: ${verifyValue[0].use_list}`);
      
      // Toggle back
      await connection.execute(
        'UPDATE teleport_configs SET use_list = ? WHERE server_id = ? AND teleport_name = ?',
        [current, testServerId, testTeleport]
      );
      
      console.log(`   Restored use_list to: ${current}`);
    } else {
      console.log(`   No config found for server ${testServerId} and teleport ${testTeleport}`);
    }

    console.log('\n✅ Database tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing teleport database:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

testTeleportDatabase();
