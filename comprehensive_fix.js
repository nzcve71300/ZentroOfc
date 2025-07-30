const mysql = require('mysql2/promise');
require('dotenv').config();

async function comprehensiveFix() {
  console.log('🚀 Comprehensive Fix for Zentro Bot');
  console.log('=====================================\n');

  // Step 1: Test database connection
  console.log('1️⃣ Testing database connection...');
  let pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    const [result] = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful!');
    
    // Step 2: Check and fix database schema
    console.log('\n2️⃣ Checking database schema...');
    
    // Check if economy table exists and has required columns
    try {
      const [economyColumns] = await pool.query('DESCRIBE economy');
      const columnNames = economyColumns.map(col => col.Field);
      
      console.log('📊 Economy table columns:', columnNames);
      
      // Add missing columns
      const requiredColumns = ['guild_id', 'server_id', 'discord_id'];
      for (const col of requiredColumns) {
        if (!columnNames.includes(col)) {
          console.log(`➕ Adding ${col} column to economy table...`);
          await pool.query(`ALTER TABLE economy ADD COLUMN ${col} VARCHAR(32)`);
        }
      }
    } catch (error) {
      console.log('❌ Economy table does not exist - creating it...');
      await pool.query(`
        CREATE TABLE economy (
          id INT AUTO_INCREMENT PRIMARY KEY,
          player_id INT,
          guild_id VARCHAR(32),
          server_id VARCHAR(32),
          discord_id VARCHAR(32),
          balance INT DEFAULT 0,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        )
      `);
    }
    
    // Check if transactions table exists and has required columns
    try {
      const [transactionColumns] = await pool.query('DESCRIBE transactions');
      const columnNames = transactionColumns.map(col => col.Field);
      
      console.log('📈 Transactions table columns:', columnNames);
      
      // Add missing columns
      const requiredColumns = ['guild_id', 'server_id', 'discord_id'];
      for (const col of requiredColumns) {
        if (!columnNames.includes(col)) {
          console.log(`➕ Adding ${col} column to transactions table...`);
          await pool.query(`ALTER TABLE transactions ADD COLUMN ${col} VARCHAR(32)`);
        }
      }
    } catch (error) {
      console.log('❌ Transactions table does not exist - creating it...');
      await pool.query(`
        CREATE TABLE transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          player_id INT,
          guild_id VARCHAR(32),
          server_id VARCHAR(32),
          discord_id VARCHAR(32),
          amount INT NOT NULL,
          type TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        )
      `);
    }
    
    // Step 3: Clean up invalid servers
    console.log('\n3️⃣ Cleaning up invalid servers...');
    const [invalidServers] = await pool.query(`
      SELECT id, nickname, ip, port 
      FROM rust_servers 
      WHERE ip = '0.0.0.0' 
         OR ip = 'PLACEHOLDER_IP' 
         OR ip = 'localhost' 
         OR ip = '127.0.0.1'
         OR ip IS NULL
         OR port = 0
         OR port IS NULL
    `);
    
    if (invalidServers.length > 0) {
      console.log(`⚠️ Found ${invalidServers.length} invalid servers:`);
      invalidServers.forEach(server => {
        console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
      });
      
      console.log('\n🗑️ Deleting invalid servers...');
      await pool.query(`
        DELETE FROM rust_servers 
        WHERE ip = '0.0.0.0' 
           OR ip = 'PLACEHOLDER_IP' 
           OR ip = 'localhost' 
           OR ip = '127.0.0.1'
           OR ip IS NULL
           OR port = 0
           OR port IS NULL
      `);
      console.log('✅ Invalid servers deleted');
    } else {
      console.log('✅ No invalid servers found');
    }
    
    // Step 4: Create indexes for performance
    console.log('\n4️⃣ Creating database indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_economy_guild_server ON economy(guild_id, server_id)',
      'CREATE INDEX IF NOT EXISTS idx_economy_discord ON economy(discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_guild_server ON transactions(guild_id, server_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_discord ON transactions(discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
        console.log(`✅ Created index: ${indexQuery.split(' ')[2]}`);
      } catch (error) {
        if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
          console.log(`ℹ️ Index already exists: ${indexQuery.split(' ')[2]}`);
        } else {
          console.error(`❌ Failed to create index: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Comprehensive fix completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart your bot to apply the RCON fixes');
    console.log('2. Add valid servers with correct IP addresses');
    console.log('3. The bot will now skip invalid servers automatically');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 To fix this:');
    console.log('1. Make sure MySQL/MariaDB is running');
    console.log('2. Check your database credentials in .env file');
    console.log('3. Ensure the database exists');
    console.log('4. Try: mysql -u root -p to test connection');
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

comprehensiveFix(); 