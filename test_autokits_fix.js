const mysql = require('mysql2/promise');
require('dotenv').config();

async function testAutokitsFix() {
  console.log('🔧 Testing autokits fix...');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    // Test the exact query that was failing
    console.log('📋 Testing autokit query...');
    
    const serverId = '1753872071391_i24dewly';
    const kitName = 'FREEkit1';
    
    // Test the query that was causing the error
    const result = await pool.query(
      'SELECT id, enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitName]
    );
    
    console.log('✅ Query executed successfully');
    console.log('📊 Result:', result);
    
    if (result.length > 0) {
      console.log('✅ Found autokit configuration');
      console.log('📋 Details:', result[0]);
    } else {
      console.log('⚠️ No autokit configuration found');
    }
    
    // Test the UPDATE query
    console.log('🔄 Testing UPDATE query...');
    await pool.query(
      'UPDATE autokits SET enabled = ? WHERE server_id = ? AND kit_name = ?',
      [true, serverId, kitName]
    );
    
    console.log('✅ UPDATE query executed successfully');
    
    // Test the SELECT query after UPDATE
    const updatedResult = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitName]
    );
    
    console.log('✅ SELECT after UPDATE executed successfully');
    console.log('📊 Updated result:', updatedResult);
    
    if (updatedResult.length > 0) {
      console.log('✅ Found updated autokit configuration');
      console.log('📋 Updated details:', updatedResult[0]);
    } else {
      console.log('⚠️ No updated autokit configuration found');
    }
    
  } catch (error) {
    console.error('❌ Error testing autokits fix:', error);
  } finally {
    await pool.end();
  }
}

testAutokitsFix(); 