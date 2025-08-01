const pool = require('./src/db');

async function createSubscriptionsTable() {
  try {
    console.log('🔧 Creating subscriptions table...');
    
    // Create the subscriptions table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        guild_id BIGINT PRIMARY KEY,
        allowed_servers INT DEFAULT 0,
        active_servers INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createTableSQL);
    console.log('✅ Subscriptions table created successfully!');
    
    // Verify the table exists
    const [result] = await pool.query('SHOW TABLES LIKE "subscriptions"');
    
    if (result.length > 0) {
      console.log('✅ Table verification successful - subscriptions table exists');
      
      // Show table structure
      const [structure] = await pool.query('DESCRIBE subscriptions');
      console.log('📋 Table structure:');
      structure.forEach(row => {
        console.log(`   ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
      });
      
      // Test inserting a sample record
      console.log('🧪 Testing subscription functionality...');
      const testGuildId = '123456789';
      
      // Try to insert a test record
      await pool.query(
        'INSERT INTO subscriptions (guild_id, allowed_servers, active_servers) VALUES (?, ?, ?)',
        [testGuildId, 1, 0]
      );
      console.log('✅ Test insert successful');
      
      // Try to query the record
      const [testResult] = await pool.query(
        'SELECT * FROM subscriptions WHERE guild_id = ?',
        [testGuildId]
      );
      
      if (testResult.length > 0) {
        console.log('✅ Test query successful');
        console.log(`   Found guild ${testResult[0].guild_id} with ${testResult[0].allowed_servers} allowed servers`);
      }
      
      // Clean up test record
      await pool.query('DELETE FROM subscriptions WHERE guild_id = ?', [testGuildId]);
      console.log('✅ Test cleanup successful');
      
    } else {
      console.log('❌ Table verification failed - subscriptions table not found');
    }
    
  } catch (error) {
    console.error('❌ Error creating subscriptions table:', error);
  } finally {
    await pool.end();
  }
}

createSubscriptionsTable(); 