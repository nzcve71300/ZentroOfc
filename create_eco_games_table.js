const pool = require('./src/db');

async function createEcoGamesTable() {
  try {
    console.log('🔧 Creating eco_games_config table...');
    
    // Create the eco_games_config table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS eco_games_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        setting_name VARCHAR(255) NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_setting (server_id, setting_name)
      )
    `;
    
    await pool.query(createTableSQL);
    console.log('✅ Eco games config table created successfully!');
    
    // Verify the table exists
    const [result] = await pool.query('SHOW TABLES LIKE "eco_games_config"');
    
    if (result.length > 0) {
      console.log('✅ Table verification successful - eco_games_config table exists');
      
      // Show table structure
      const [structure] = await pool.query('DESCRIBE eco_games_config');
      console.log('📋 Table structure:');
      structure.forEach(row => {
        console.log(`   ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
      });
      
      // Test inserting a sample record
      console.log('🧪 Testing eco games functionality...');
      const testServerId = '1753965211295_c5pfupu9';
      const testSetting = 'blackjack_toggle';
      const testValue = 'true';
      
      // Try to insert a test record
      await pool.query(
        'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [testServerId, testSetting, testValue]
      );
      console.log('✅ Test insert successful');
      
      // Try to query the record
      const [testResult] = await pool.query(
        'SELECT * FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
        [testServerId, testSetting]
      );
      
      if (testResult.length > 0) {
        console.log('✅ Test query successful');
        console.log(`   Found setting: ${testResult[0].setting_name} = ${testResult[0].setting_value}`);
      }
      
      // Clean up test record
      await pool.query('DELETE FROM eco_games_config WHERE server_id = ? AND setting_name = ?', [testServerId, testSetting]);
      console.log('✅ Test cleanup successful');
      
    } else {
      console.log('❌ Table verification failed - eco_games_config table not found');
    }
    
  } catch (error) {
    console.error('❌ Error creating eco games table:', error);
  } finally {
    await pool.end();
  }
}

createEcoGamesTable(); 