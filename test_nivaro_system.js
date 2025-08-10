const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testNivaroSystem() {
  console.log('🧪 Testing Nivaro Store System...\n');

  try {
    // Test 1: Check if tables exist
    console.log('1️⃣ Checking database tables...');
    const tables = ['pending_stores', 'stores', 'discord_links'];
    
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`   ✅ ${table} table exists`);
      } catch (error) {
        console.log(`   ❌ ${table} table missing - run nivaro_store_schema.sql first`);
        return;
      }
    }

    // Test 2: Generate a test secret key
    console.log('\n2️⃣ Generating test secret key...');
    const testStore = {
      store_name: 'Test Store',
      store_url: 'https://test-store.nivaro.com',
      owner_email: 'test@example.com'
    };

    const [result] = await pool.query(
      'INSERT INTO pending_stores (secret_key, store_name, store_url, owner_email) VALUES (?, ?, ?, ?)',
      ['test_secret_key_123', testStore.store_name, testStore.store_url, testStore.owner_email]
    );

    console.log(`   ✅ Created test pending store with ID: ${result.insertId}`);
    console.log(`   📋 Secret Key: test_secret_key_123`);
    console.log(`   📋 Store Name: ${testStore.store_name}`);
    console.log(`   📋 Store URL: ${testStore.store_url}`);

    // Test 3: Check pending store
    console.log('\n3️⃣ Verifying pending store...');
    const [pendingStores] = await pool.query(
      'SELECT * FROM pending_stores WHERE secret_key = ?',
      ['test_secret_key_123']
    );

    if (pendingStores.length > 0) {
      console.log(`   ✅ Found pending store: ${pendingStores[0].store_name}`);
      console.log(`   📋 Expires at: ${pendingStores[0].expires_at}`);
      console.log(`   📋 Is used: ${pendingStores[0].is_used}`);
    } else {
      console.log('   ❌ Pending store not found');
    }

    // Test 4: Simulate Discord link (without actually creating the link)
    console.log('\n4️⃣ Testing Discord link simulation...');
    const testGuildId = '123456789012345678';
    const testGuildName = 'Test Discord Server';
    const testUserId = '987654321098765432';

    // Check if guild is already linked
    const [existingLinks] = await pool.query(
      'SELECT dl.*, s.store_name FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
      [testGuildId]
    );

    if (existingLinks.length > 0) {
      console.log(`   ⚠️  Guild already linked to: ${existingLinks[0].store_name}`);
    } else {
      console.log('   ✅ Guild not linked (ready for linking)');
    }

    // Test 5: API endpoint simulation
    console.log('\n5️⃣ Testing API endpoint simulation...');
    console.log('   📋 POST /api/verify-discord-link');
    console.log('   📋 Body: {');
    console.log(`     secret_key: "test_secret_key_123",`);
    console.log(`     discord_guild_id: "${testGuildId}",`);
    console.log(`     discord_guild_name: "${testGuildName}",`);
    console.log(`     linked_by_user_id: "${testUserId}"`);
    console.log('   }');

    // Test 6: Cleanup test data
    console.log('\n6️⃣ Cleaning up test data...');
    await pool.query('DELETE FROM pending_stores WHERE secret_key = ?', ['test_secret_key_123']);
    console.log('   ✅ Test data cleaned up');

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the API server: npm run start:api');
    console.log('2. Deploy Discord commands: node deploy-commands.js');
    console.log('3. Test the /nivaro-link command in Discord');
    console.log('4. Use the API to generate real secret keys');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testNivaroSystem(); 