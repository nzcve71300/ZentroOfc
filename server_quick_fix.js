const mysql = require('mysql2/promise');
require('dotenv').config();

async function serverQuickFix() {
  console.log('🚀 Server Quick Fix for Zentro Bot');
  console.log('===================================\n');

  let pool;
  try {
    // Test database connection
    console.log('1️⃣ Testing database connection...');
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
    
    // Step 1: Delete invalid servers immediately
    console.log('\n2️⃣ Deleting invalid servers...');
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
    
    // Step 2: Fix database schema
    console.log('\n3️⃣ Fixing database schema...');
    
    // Add missing columns to economy table
    try {
      await pool.query('ALTER TABLE economy ADD COLUMN guild_id VARCHAR(32)');
      console.log('✅ Added guild_id to economy table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ guild_id already exists in economy table');
      } else {
        console.error('❌ Failed to add guild_id to economy:', error.message);
      }
    }
    
    try {
      await pool.query('ALTER TABLE economy ADD COLUMN server_id VARCHAR(32)');
      console.log('✅ Added server_id to economy table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ server_id already exists in economy table');
      } else {
        console.error('❌ Failed to add server_id to economy:', error.message);
      }
    }
    
    try {
      await pool.query('ALTER TABLE economy ADD COLUMN discord_id VARCHAR(32)');
      console.log('✅ Added discord_id to economy table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ discord_id already exists in economy table');
      } else {
        console.error('❌ Failed to add discord_id to economy:', error.message);
      }
    }
    
    // Add missing columns to transactions table
    try {
      await pool.query('ALTER TABLE transactions ADD COLUMN guild_id VARCHAR(32)');
      console.log('✅ Added guild_id to transactions table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ guild_id already exists in transactions table');
      } else {
        console.error('❌ Failed to add guild_id to transactions:', error.message);
      }
    }
    
    try {
      await pool.query('ALTER TABLE transactions ADD COLUMN server_id VARCHAR(32)');
      console.log('✅ Added server_id to transactions table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ server_id already exists in transactions table');
      } else {
        console.error('❌ Failed to add server_id to transactions:', error.message);
      }
    }
    
    try {
      await pool.query('ALTER TABLE transactions ADD COLUMN discord_id VARCHAR(32)');
      console.log('✅ Added discord_id to transactions table');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ discord_id already exists in transactions table');
      } else {
        console.error('❌ Failed to add discord_id to transactions:', error.message);
      }
    }
    
    console.log('\n✅ Server quick fix completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Check logs: pm2 logs zentro-bot');
    console.log('3. The RCON connection spam should stop');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 To fix this:');
    console.log('1. Make sure MySQL/MariaDB is running');
    console.log('2. Check your database credentials in .env file');
    console.log('3. Ensure the database exists');
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

serverQuickFix(); 