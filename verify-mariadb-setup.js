const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

async function verifySetup() {
  console.log('🔍 Verifying MariaDB setup for Zentro Bot...\n');
  
  try {
    // Test 1: Database Connection
    console.log('✅ Test 1: Database Connection');
    const [connectionTest] = await pool.execute('SELECT 1 as test');
    console.log('   Connection successful\n');
    
    // Test 2: Check Required Tables
    console.log('✅ Test 2: Required Tables');
    const requiredTables = [
      'guilds', 'rust_servers', 'players', 'economy', 'transactions',
      'shop_categories', 'shop_items', 'shop_kits', 'autokits',
      'kit_auth', 'killfeed_configs', 'player_stats', 'channel_settings',
      'position_coordinates', 'zones', 'link_requests', 'link_blocks'
    ];
    
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [process.env.DB_NAME]);
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length === 0) {
      console.log('   All required tables exist');
    } else {
      console.log('   ❌ Missing tables:', missingTables.join(', '));
    }
    console.log('');
    
    // Test 3: Check Table Structure
    console.log('✅ Test 3: Table Structure');
    const keyTables = ['guilds', 'rust_servers', 'players'];
    
    for (const tableName of keyTables) {
      try {
        const [columns] = await pool.execute(`
          SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, EXTRA
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        `, [process.env.DB_NAME, tableName]);
        
        if (columns.length > 0) {
          console.log(`   ${tableName}: ${columns.length} columns`);
        } else {
          console.log(`   ❌ ${tableName}: Table not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${tableName}: Error - ${error.message}`);
      }
    }
    console.log('');
    
    // Test 4: Test Basic Operations
    console.log('✅ Test 4: Basic Operations');
    
    // Test insert
    try {
      const [insertResult] = await pool.execute(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        ['999999999', 'Test Guild - Verification']
      );
      console.log('   Insert test: PASSED');
      
      // Test select
      const [selectResult] = await pool.execute(
        'SELECT * FROM guilds WHERE discord_id = ?',
        ['999999999']
      );
      console.log('   Select test: PASSED');
      
      // Test update
      await pool.execute(
        'UPDATE guilds SET name = ? WHERE discord_id = ?',
        ['Updated Test Guild', '999999999']
      );
      console.log('   Update test: PASSED');
      
      // Test delete
      await pool.execute('DELETE FROM guilds WHERE discord_id = ?', ['999999999']);
      console.log('   Delete test: PASSED');
      
    } catch (error) {
      console.log(`   ❌ CRUD test failed: ${error.message}`);
    }
    console.log('');
    
    // Test 5: Check Auto-increment
    console.log('✅ Test 5: Auto-increment');
    const [autoIncrementCheck] = await pool.execute(`
      SELECT COLUMN_NAME, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'guilds' 
      AND COLUMN_NAME = 'id'
    `, [process.env.DB_NAME]);
    
    if (autoIncrementCheck.length > 0 && autoIncrementCheck[0].EXTRA.includes('auto_increment')) {
      console.log('   Auto-increment working correctly');
    } else {
      console.log('   ❌ Auto-increment not configured properly');
    }
    console.log('');
    
    // Test 6: Environment Variables
    console.log('✅ Test 6: Environment Variables');
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DISCORD_TOKEN'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length === 0) {
      console.log('   All required environment variables are set');
    } else {
      console.log(`   ❌ Missing environment variables: ${missingEnvVars.join(', ')}`);
    }
    console.log('');
    
    // Summary
    console.log('🎉 Setup Verification Complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start the bot: npm start');
    console.log('3. Deploy slash commands using the deploy scripts');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Check if MariaDB is running');
    console.log('2. Verify database credentials in .env file');
    console.log('3. Run setup-mariadb.bat to set up database');
    console.log('4. Run apply-mariadb-schema.bat to create tables');
  } finally {
    await pool.end();
  }
}

verifySetup(); 