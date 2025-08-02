const pool = require('./src/db');

async function testSchedulerTable() {
  try {
    console.log('🔍 Checking if scheduler_messages table exists...');
    
    // Check if table exists
    const [result] = await pool.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'zentro_bot' AND table_name = 'scheduler_messages'"
    );
    
    if (result[0].count === 0) {
      console.log('❌ Table does not exist. Creating scheduler_messages table...');
      
      // Create the table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scheduler_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NOT NULL,
          message1 TEXT NOT NULL,
          message2 TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_server_id (server_id)
        )
      `);
      
      console.log('✅ scheduler_messages table created successfully!');
    } else {
      console.log('✅ scheduler_messages table already exists!');
    }
    
    // Test inserting a sample record
    console.log('🧪 Testing table functionality...');
    
    const [insertResult] = await pool.query(
      'INSERT INTO scheduler_messages (server_id, message1, message2) VALUES (?, ?, ?)',
      ['test_server', 'Test Message 1', 'Test Message 2']
    );
    
    console.log('✅ Test insert successful!');
    
    // Clean up test data
    await pool.query('DELETE FROM scheduler_messages WHERE server_id = ?', ['test_server']);
    console.log('🧹 Test data cleaned up!');
    
    console.log('🎉 Scheduler table is ready to use!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testSchedulerTable(); 