const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkServers() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking rust_servers table...');
    
    // Get all servers
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id FROM rust_servers ORDER BY guild_id, id
    `);

    console.log('📋 Available servers:');
    servers.forEach(server => {
      console.log(`   ID: ${server.id}, Name: ${server.nickname}, Guild: ${server.guild_id}`);
    });

    // Check what server IDs are being used in the restoration script
    console.log('\n🔍 Checking what server IDs the restoration script is trying to use...');
    
    // The original script was using server_id = 1 for "Dead-ops", let's see what the actual ID is
    const [deadOpsServer] = await connection.execute(`
      SELECT id, nickname, guild_id FROM rust_servers WHERE nickname LIKE '%Dead%' OR nickname LIKE '%dead%'
    `);
    
    console.log('📋 Servers with "Dead" in name:');
    deadOpsServer.forEach(server => {
      console.log(`   ID: ${server.id}, Name: ${server.nickname}, Guild: ${server.guild_id}`);
    });

    // Check what server IDs are actually being used in the players table
    const [usedServerIds] = await connection.execute(`
      SELECT DISTINCT server_id, COUNT(*) as player_count
      FROM players 
      WHERE is_active = TRUE
      GROUP BY server_id
      ORDER BY server_id
    `);
    
    console.log('\n📊 Server IDs currently used in players table:');
    usedServerIds.forEach(server => {
      console.log(`   server_id: ${server.server_id}, players: ${server.player_count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkServers();