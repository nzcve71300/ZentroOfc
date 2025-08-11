const pool = require('./src/db');

async function debugNivaroSystem() {
  try {
    console.log('🔍 Debugging Nivaro System...\n');

    // 1. Check if tables exist
    console.log('1. Checking database tables...');
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('pending_stores', 'stores', 'discord_links')
    `, [process.env.DB_NAME]);
    
    console.log('Found tables:', tables.map(t => t.TABLE_NAME));
    
    // 2. Check pending_stores table structure
    console.log('\n2. Checking pending_stores structure...');
    const [columns] = await pool.query(`
      DESCRIBE pending_stores
    `);
    console.log('pending_stores columns:', columns.map(c => `${c.Field} (${c.Type})`));
    
    // 3. Check if there are any pending stores
    console.log('\n3. Checking for existing pending stores...');
    const [pendingStores] = await pool.query(`
      SELECT id, store_name, secret_key, is_used, expires_at, created_at 
      FROM pending_stores 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (pendingStores.length === 0) {
      console.log('❌ No pending stores found in database');
    } else {
      console.log(`✅ Found ${pendingStores.length} pending stores:`);
      pendingStores.forEach(store => {
        console.log(`   - ${store.store_name}: ${store.secret_key.substring(0, 8)}... (used: ${store.is_used}, expires: ${store.expires_at})`);
      });
    }
    
    // 4. Test secret key generation
    console.log('\n4. Testing secret key generation...');
    const testSecretKey = require('crypto').randomBytes(32).toString('hex');
    console.log(`Generated test key: ${testSecretKey.substring(0, 8)}...`);
    
    // 5. Check if API server is running
    console.log('\n5. Testing API server connection...');
    try {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 8081,
        path: '/health',
        method: 'GET',
        timeout: 5000
      };
      
      const req = http.request(options, (res) => {
        console.log(`✅ API server is running on port 8081 (status: ${res.statusCode})`);
      });
      
      req.on('error', (err) => {
        console.log('❌ API server is not running on port 8081');
        console.log('   Error:', err.message);
      });
      
      req.on('timeout', () => {
        console.log('❌ API server timeout - not responding');
        req.destroy();
      });
      
      req.end();
      
    } catch (error) {
      console.log('❌ Error testing API server:', error.message);
    }
    
    // 6. Check environment variables
    console.log('\n6. Checking environment variables...');
    console.log('DB_HOST:', process.env.DB_HOST ? 'Set' : 'Not set');
    console.log('DB_USER:', process.env.DB_USER ? 'Set' : 'Not set');
    console.log('DB_NAME:', process.env.DB_NAME ? 'Set' : 'Not set');
    console.log('API_PORT:', process.env.API_PORT || 'Not set (using default 3001)');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await pool.end();
  }
}

debugNivaroSystem(); 