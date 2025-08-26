const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugEventSystem() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Debugging Event System...\n');

    // Test with a specific server
    const testServer = 'Emperor 3x'; // Change this to your server name
    const testGuildId = 'YOUR_GUILD_ID'; // Change this to your guild ID

    console.log(`🧪 Testing with server: ${testServer}`);

    // Get server ID
    const [serverResult] = await connection.execute(`
      SELECT rs.id FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      WHERE rs.nickname = ? AND g.discord_id = ?
    `, [testServer, testGuildId]);

    if (serverResult.length === 0) {
      console.log('❌ Server not found');
      return;
    }

    const serverId = serverResult[0].id;
    console.log(`✅ Server ID: ${serverId}`);

    // Check Bradley configuration
    console.log('\n📋 Checking Bradley configuration...');
    const [bradleyConfig] = await connection.execute(
      'SELECT * FROM event_configs WHERE server_id = ? AND event_type = ?',
      [serverId.toString(), 'bradley']
    );

    if (bradleyConfig.length === 0) {
      console.log('❌ No Bradley configuration found');
      return;
    }

    const config = bradleyConfig[0];
    console.log(`✅ Bradley config found:`);
    console.log(`   - Enabled: ${config.enabled}`);
    console.log(`   - Kill Message: ${config.kill_message}`);
    console.log(`   - Respawn Message: ${config.respawn_message}`);

    if (!config.enabled) {
      console.log('\n⚠️ Bradley detection is DISABLED');
      console.log('   Enable it with: /set config:BRADLEY-SCOUT option:on server:' + testServer);
    } else {
      console.log('\n✅ Bradley detection is ENABLED');
    }

    // Test RCON connection
    console.log('\n🔗 Testing RCON connection...');
    const { sendRconCommand } = require('./src/rcon/index.js');
    
    // Get server connection details
    const [serverDetails] = await connection.execute(`
      SELECT ip, port, password FROM rust_servers 
      WHERE id = ?
    `, [serverId]);

    if (serverDetails.length === 0) {
      console.log('❌ Server details not found');
      return;
    }

    const { ip, port, password } = serverDetails[0];
    console.log(`   Server: ${ip}:${port}`);

    // Test basic RCON command
    console.log('\n🧪 Testing RCON command...');
    try {
      const testResult = await sendRconCommand(ip, port, password, 'echo "Event system test"');
      console.log(`✅ RCON test result: ${testResult ? 'Success' : 'Failed'}`);
      
      if (testResult) {
        console.log(`   Response: ${testResult.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ RCON test failed: ${error.message}`);
    }

    // Test Bradley gib detection
    console.log('\n🎯 Testing Bradley gib detection...');
    try {
      const bradleyResult = await sendRconCommand(ip, port, password, 'find_entity servergibs_bradley');
      console.log(`✅ Bradley gib check result: ${bradleyResult ? 'Found' : 'Not found'}`);
      
      if (bradleyResult) {
        console.log(`   Response: ${bradleyResult.substring(0, 200)}...`);
        
        if (bradleyResult.includes('servergibs_bradley')) {
          console.log('🎉 Bradley gibs detected! This should trigger the event.');
        } else {
          console.log('ℹ️ No Bradley gibs currently present');
        }
      }
    } catch (error) {
      console.log(`❌ Bradley gib check failed: ${error.message}`);
    }

    // Test sending a message
    console.log('\n💬 Testing message sending...');
    try {
      const messageResult = await sendRconCommand(ip, port, password, 'say <color=#FF0000>Event System Test Message</color>');
      console.log(`✅ Message test: ${messageResult ? 'Sent' : 'Failed'}`);
    } catch (error) {
      console.log(`❌ Message test failed: ${error.message}`);
    }

    console.log('\n🔧 Debug complete!');

  } catch (error) {
    console.error('❌ Error debugging event system:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

debugEventSystem();
