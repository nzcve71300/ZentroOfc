const mysql = require('mysql2/promise');
require('dotenv').config();

async function emergencyFix() {
  console.log('🚨 EMERGENCY FIX - Deleting invalid servers...');
  
  let pool;
  try {
    // Connect to database
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
    
    console.log('✅ Database connected');
    
    // DELETE ALL INVALID SERVERS IMMEDIATELY
    console.log('🗑️ Deleting all invalid servers...');
    
    const deleteResult = await pool.query(`
      DELETE FROM rust_servers 
      WHERE ip = '0.0.0.0' 
         OR ip = 'PLACEHOLDER_IP' 
         OR ip = 'localhost' 
         OR ip = '127.0.0.1'
         OR ip IS NULL
         OR port = 0
         OR port IS NULL
    `);
    
    console.log(`✅ Deleted ${deleteResult[0].affectedRows} invalid servers`);
    
    // Check remaining servers
    const [remainingServers] = await pool.query('SELECT COUNT(*) as count FROM rust_servers');
    console.log(`📊 Remaining servers: ${remainingServers[0].count}`);
    
    if (remainingServers[0].count > 0) {
      const [servers] = await pool.query('SELECT nickname, ip, port FROM rust_servers');
      console.log('📋 Valid servers:');
      servers.forEach(server => {
        console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
      });
    } else {
      console.log('⚠️ No valid servers found - add some with correct IP addresses');
    }
    
    console.log('\n✅ Emergency fix completed!');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

emergencyFix(); 