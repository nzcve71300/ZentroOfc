const mysql = require('mysql2/promise');
require('dotenv').config();

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

async function cleanupOldServers() {
  try {
    console.log('🧹 Cleaning up old servers with invalid IP addresses...');
    
    // Check current servers
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log('📊 Current servers in database:');
    servers.forEach(server => {
      console.log(`  - ${server.nickname}: ${server.ip}:${server.port}`);
    });
    
    // Delete servers with invalid IP addresses
    const [deleteResult] = await pool.query(
      'DELETE FROM rust_servers WHERE ip = ? OR ip = ? OR port = ? OR port IS NULL',
      ['0.0.0.0', 'PLACEHOLDER_IP', 0]
    );
    
    console.log(`🗑️ Deleted ${deleteResult.affectedRows} servers with invalid IP addresses`);
    
    // Check remaining servers
    const [remainingServers] = await pool.query('SELECT * FROM rust_servers');
    console.log('📊 Remaining servers in database:');
    remainingServers.forEach(server => {
      console.log(`  - ${server.nickname}: ${server.ip}:${server.port}`);
    });
    
    console.log('✅ Cleanup completed!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await pool.end();
  }
}

cleanupOldServers(); 